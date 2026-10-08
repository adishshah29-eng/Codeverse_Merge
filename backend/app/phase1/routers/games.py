"""Phase 1 challenge endpoints (all five stages share one shape).

    GET  /games/{n}/brief      stage description, submission form spec, unlocked hints, current best
    GET  /games/{n}/handout    the team's zip download for the stage
    POST /games/{n}/submit     grade a submission (partial credit; best raw grade is kept)
    POST /games/{n}/finalize   lock in the current best score and move on to the next stage
"""
import logging
import threading
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Response

from app.phase1.core.config import settings
from app.phase1.core.database import decode_json, get_scoring_config, update_rows
from app.phase1.core.engine import ProgressionEngine
from app.phase1.core.models import GenericSubmissionResponse, StageSubmission
from app.phase1.core.scoring import net_stage_score
from app.phase1.deps import phase1_team_id
from app.phase1.games.common import handout_zip
from app.phase1.games.registry import get_stage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/games", tags=["Games"])

SUBMIT_COOLDOWN_SECONDS = 4.0
_last_submit: Dict[tuple, float] = {}
_last_submit_lock = threading.Lock()


def _require_open(progress: Dict[str, Any], stage_id: int) -> None:
    if progress["status"] in ("COMPLETED", "SKIPPED"):
        raise HTTPException(status_code=400, detail=f"Stage {stage_id} is already finalized ({progress['status']}).")


def _public_meta(stage) -> Dict[str, Any]:
    meta = stage.META
    return {
        "stage_id": meta["id"],
        "title": meta["title"],
        "domain": meta["domain"],
        "difficulty": meta["difficulty"],
        "brief": meta["brief"],
        "submit": meta["submit"],
        "hints_total": len(meta.get("hints", [])),
        "hint_penalties": get_scoring_config().get(f"game_{meta['id']}", {}).get("hint_penalties", [0.5, 1.0, 1.5]),
        "wrong_attempt_penalty": get_scoring_config().get(f"game_{meta['id']}", {}).get("wrong_attempt_penalty", 0.0),
        "handout_filename": f"{meta['handout']}.zip",
    }


@router.get("/{stage_id}/brief")
def get_brief(stage_id: int, team_id: str = Depends(phase1_team_id)):
    stage = get_stage(stage_id)
    progress = ProgressionEngine.verify_stage_access(team_id, stage_id)
    metadata = decode_json(progress["metadata"], {})
    hints_used = decode_json(progress["hints_used"], [])
    hints = stage.META.get("hints", [])
    return {
        **_public_meta(stage),
        "status": progress["status"],
        "score": float(progress["score"]),
        "best_raw": float(metadata.get("best_raw", 0.0)),
        "last_checks": metadata.get("best_checks", []),
        "last_message": metadata.get("best_message", ""),
        "attempts_count": progress["attempts_count"],
        "wrong_attempts": progress["wrong_attempts"],
        "unlocked_hints": [{"index": i, "text": hints[i]} for i in hints_used if 0 <= i < len(hints)],
    }


@router.get("/{stage_id}/handout")
def download_handout(stage_id: int, team_id: str = Depends(phase1_team_id)):
    stage = get_stage(stage_id)
    ProgressionEngine.verify_stage_access(team_id, stage_id)
    try:
        data = handout_zip(stage.META["handout"])
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Handout is not available. Contact the organizers.")
    return Response(content=data, media_type="application/zip", headers={
        "Content-Disposition": f'attachment; filename="{stage.META["handout"]}.zip"',
        "Cache-Control": "private, no-store",
    })


def _response(stage_id: int, *, success: bool, perfect: bool, awarded: float, total: float, message: str,
              feedback: Optional[Dict[str, Any]], next_stage: Optional[int] = None, complete: bool = False):
    return GenericSubmissionResponse(
        success=success, stage_id=stage_id, passed=perfect, score_awarded=awarded, total_stage_score=total,
        message=message, feedback=feedback, next_stage=next_stage, mission_complete=complete,
    )


def _next(stage_id: int) -> Optional[int]:
    return stage_id + 1 if stage_id < settings.TOTAL_STAGES else None


@router.post("/{stage_id}/submit", response_model=GenericSubmissionResponse)
def submit(stage_id: int, payload: StageSubmission, team_id: str = Depends(phase1_team_id)):
    stage = get_stage(stage_id)
    progress = ProgressionEngine.verify_stage_access(team_id, stage_id)
    _require_open(progress, stage_id)

    existing = ProgressionEngine.check_idempotency(team_id, stage_id, payload.idempotency_key)
    if existing:
        return _response(stage_id, success=True, perfect=bool(existing["passed"]),
                         awarded=existing["score_awarded"], total=float(progress["score"]),
                         message="Idempotent: returning the previously recorded result.", feedback=None)

    now = time.monotonic()
    with _last_submit_lock:
        previous = _last_submit.get((team_id, stage_id), 0.0)
        if now - previous < SUBMIT_COOLDOWN_SECONDS:
            raise HTTPException(status_code=429, detail="Slow down — wait a few seconds between submissions.")
        _last_submit[(team_id, stage_id)] = now

    try:
        graded = stage.grade(dict(payload.files), dict(payload.answers))
    except Exception:  # a grader bug must never cost a team points
        logger.exception("Phase 1 grader crashed (stage %s)", stage_id)
        with _last_submit_lock:
            _last_submit.pop((team_id, stage_id), None)
        raise HTTPException(status_code=500, detail="The grader hit an internal error. Your attempt was not counted — try again or tell the organizers.")

    if graded.get("retry"):   # sandbox busy / unavailable: nothing is recorded
        with _last_submit_lock:
            _last_submit.pop((team_id, stage_id), None)
        raise HTTPException(status_code=503, detail=graded["message"])

    valid, raw = bool(graded["valid"]), float(graded["score"])
    metadata = decode_json(progress["metadata"], {})
    previous_best = float(metadata.get("best_raw", 0.0))
    if valid and raw >= previous_best:
        metadata.update({"best_raw": raw, "best_checks": graded["checks"], "best_message": graded["message"],
                         "best_details": graded.get("details", {})})
    metadata["last_raw"] = raw
    metadata["submissions"] = int(metadata.get("submissions", 0)) + 1

    stored_payload = {"files": payload.files, "answers": payload.answers}
    ProgressionEngine.record_submission_attempt(
        team_id=team_id, stage_id=stage_id, idempotency_key=payload.idempotency_key,
        payload=stored_payload, passed=valid, score_awarded=raw if valid else 0.0, feedback=graded["message"],
    )
    update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {"metadata": metadata})

    fresh = ProgressionEngine.verify_stage_access(team_id, stage_id)
    best_raw = float(metadata.get("best_raw", 0.0))
    net = net_stage_score(stage_id, best_raw, int(fresh["wrong_attempts"]), decode_json(fresh["hints_used"], []))
    feedback = {
        "checks": graded["checks"], "details": graded.get("details", {}), "raw_score": raw,
        "best_raw": best_raw, "net_score": net["score"], "breakdown": net["breakdown"], "improved": valid and raw >= previous_best,
    }

    if valid and graded["perfect"]:
        ProgressionEngine.complete_stage(team_id, stage_id, net["score"],
                                         metadata={**metadata, "breakdown": net["breakdown"], "completed_by": "perfect"})
        nxt = _next(stage_id)
        return _response(stage_id, success=True, perfect=True, awarded=raw, total=net["score"],
                         message=graded["message"], feedback=feedback, next_stage=nxt, complete=nxt is None)

    ProgressionEngine.refresh_stage_score(team_id, stage_id)
    return _response(stage_id, success=valid, perfect=False, awarded=raw if valid else 0.0, total=net["score"],
                     message=graded["message"], feedback=feedback)


@router.post("/{stage_id}/finalize", response_model=GenericSubmissionResponse)
def finalize(stage_id: int, team_id: str = Depends(phase1_team_id)):
    """Lock in the best score so far and unlock the next stage (partial credit is natural here)."""
    get_stage(stage_id)
    progress = ProgressionEngine.verify_stage_access(team_id, stage_id)
    _require_open(progress, stage_id)
    metadata = decode_json(progress["metadata"], {})
    best_raw = float(metadata.get("best_raw", 0.0))
    if best_raw <= 0:
        raise HTTPException(status_code=400, detail="Nothing to lock in yet — submit something that scores, or skip the stage.")
    net = net_stage_score(stage_id, best_raw, int(progress["wrong_attempts"]), decode_json(progress["hints_used"], []))
    ProgressionEngine.complete_stage(team_id, stage_id, net["score"],
                                     metadata={**metadata, "breakdown": net["breakdown"], "completed_by": "finalize"})
    nxt = _next(stage_id)
    return _response(stage_id, success=True, perfect=False, awarded=best_raw, total=net["score"],
                     message=f"Stage locked in at {net['score']:.2f} / 10.", feedback={"breakdown": net["breakdown"]},
                     next_stage=nxt, complete=nxt is None)
