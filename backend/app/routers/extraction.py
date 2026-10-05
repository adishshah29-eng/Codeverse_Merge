import json
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team, require_stage
from ..db import get_db
from ..games.extraction.engine import (
    calculate_final_heist_score,
    verify_artifacts,
    verify_sequence_order,
)
from ..models import AuditEvent, ConfigKV, GameOutput, Penalty, StageProgress, Submission, Team
from ..security import record_submission_attempt

router = APIRouter(
    prefix="/api/extraction",
    tags=["extraction"],
    dependencies=[Depends(require_stage(4))],
)

def _cfg(db: Session, key: str) -> str:
    row = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if not row:
        raise HTTPException(status_code=503, detail=f"Game configuration is missing: {key}")
    return row.value


@router.get("/status")
def get_extraction_status(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    outputs = db.query(GameOutput).filter(GameOutput.team_id == team.id).all()
    output_keys = {o.key for o in outputs}

    progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 4,
    ).one_or_none()

    # SECURITY: Return ONLY boolean "acquired" flags, NOT the actual key values
    return {
        "success": True,
        "team_code": team.code,
        "team_name": team.name,
        "money": team.money,
        "risk": team.risk,
        "outputs_acquired_flags": {
            "deletion_key": "deletion_key" in output_keys,
            "shutdown_code": "shutdown_code" in output_keys,
            "control_token": "control_token" in output_keys,
            "route_code": "route_code" in output_keys,
        },
        "completed": progress.status == "completed" if progress else False,
        "final_score": team.final_score,
    }


class VerifyArtifactsRequest(BaseModel):
    deletion_key: str
    shutdown_code: str
    control_token: str = ""
    route_code: str = ""


@router.post("/verify-artifacts")
def verify_extraction_artifacts(
    req: VerifyArtifactsRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    record_submission_attempt(db, team.id, "extraction_artifact_submission_attempt")

    # Load server-authoritative expected values from game outputs
    outputs = db.query(GameOutput).filter(GameOutput.team_id == team.id).all()
    output_dict = {o.key: o.value for o in outputs}

    # Shutdown code comes from ConfigKV (event-wide constant, not per-team)
    expected_shutdown = _cfg(db, "stage4_shutdown_code")

    result = verify_artifacts(
        req.deletion_key,
        req.shutdown_code,
        req.control_token,
        req.route_code,
        output_dict,
        expected_shutdown=expected_shutdown,
    )

    # Audit validation attempt — log pass/fail but NOT the submitted values
    db.add(AuditEvent(
        team_id=team.id,
        event_type="extraction_artifacts_checked",
        payload=json.dumps({"all_valid": result["all_valid"]}),
    ))
    db.commit()

    time_remaining = None
    if result["all_valid"]:
        timer_secs = int(_cfg(db, "extraction_timer_seconds"))
        verified_at = datetime.now(timezone.utc)
        prior_checks = (
            db.query(AuditEvent)
            .filter(
                AuditEvent.team_id == team.id,
                AuditEvent.event_type == "extraction_artifacts_checked",
            )
            .order_by(AuditEvent.id.asc())
            .all()
        )
        for event in prior_checks:
            if json.loads(event.payload or "{}").get("all_valid"):
                verified_at = event.created_at
                break
        if verified_at.tzinfo is None:
            verified_at = verified_at.replace(tzinfo=timezone.utc)
        elapsed = max(0, int((datetime.now(timezone.utc) - verified_at).total_seconds()))
        time_remaining = max(0, timer_secs - elapsed)

    return {
        "success": result["all_valid"],
        "fields": result["fields"],
        "message": result["message"],
        "time_remaining_seconds": time_remaining,
    }


class SubmitSequenceRequest(BaseModel):
    sequence: List[str]


@router.post("/submit-sequence")
def submit_extraction_sequence(
    req: SubmitSequenceRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    # Idempotency guard
    existing = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 4,
        StageProgress.status == "completed",
    ).one_or_none()
    if existing:
        return {
            "success": True,
            "message": "Stage 4 is already completed.",
            "already_completed": True,
            "final_score": team.final_score,
        }

    record_submission_attempt(db, team.id, "extraction_sequence_submission_attempt")

    # Require artifact verification first
    checks = (
        db.query(AuditEvent)
        .filter(
            AuditEvent.team_id == team.id,
            AuditEvent.event_type == "extraction_artifacts_checked",
        )
        .order_by(AuditEvent.id.asc())
        .all()
    )
    verified_at = next(
        (
            event.created_at
            for event in checks
            if json.loads(event.payload or "{}").get("all_valid")
        ),
        None,
    )
    if not verified_at:
        raise HTTPException(status_code=403, detail="Verify all extraction artifacts first")

    if verified_at.tzinfo is None:
        verified_at = verified_at.replace(tzinfo=timezone.utc)

    timer_secs = int(_cfg(db, "extraction_timer_seconds"))
    elapsed = max(0, int((datetime.now(timezone.utc) - verified_at).total_seconds()))
    remaining_seconds = max(0, timer_secs - elapsed)

    # Load correct sequence from ConfigKV (server-authoritative)
    seq_raw = _cfg(db, "stage4_sequence")
    expected_sequence = [s.strip().lower() for s in seq_raw.split(",") if s.strip()]

    ok, message = verify_sequence_order(req.sequence, expected_sequence)
    if not ok:
        wrong_penalty = float(_cfg(db, "extraction_wrong_sequence_penalty"))
        penalty = Penalty(
            team_id=team.id,
            reason="Incorrect Final Extraction Sequence Order",
            amount=wrong_penalty,
            source="extraction_wrong_sequence",
        )
        db.add(penalty)
        db.add(AuditEvent(
            team_id=team.id,
            event_type="extraction_wrong_sequence",
            payload=json.dumps({"penalty": wrong_penalty}),
        ))
        db.commit()
        return {"success": False, "message": message, "penalty_applied": wrong_penalty}

    # Sequence succeeded — mark Stage 4 complete
    stage4_score = float(_cfg(db, "stage4_max_score"))

    progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 4,
    ).one_or_none()
    if not progress:
        progress = StageProgress(team_id=team.id, stage=4, status="completed", score=stage4_score)
        db.add(progress)
    else:
        progress.status = "completed"
        progress.score = stage4_score
        progress.updated_at = datetime.utcnow()

    # Calculate authoritative final event score
    all_progress = db.query(StageProgress).filter(StageProgress.team_id == team.id).all()
    stage_scores_sum = sum(p.score for p in all_progress)

    all_penalties = db.query(Penalty).filter(Penalty.team_id == team.id).all()
    total_penalties = sum(p.amount for p in all_penalties)

    # Score multipliers from ConfigKV
    final_score = calculate_final_heist_score(
        stage_scores_sum=stage_scores_sum,
        total_penalties=total_penalties,
        remaining_money=team.money,
        accumulated_risk=team.risk,
        remaining_time_seconds=remaining_seconds,
        money_divisor=float(_cfg(db, "score_money_divisor")),
        risk_multiplier=float(_cfg(db, "score_risk_multiplier")),
        time_multiplier=float(_cfg(db, "score_time_multiplier")),
    )
    team.final_score = final_score

    db.add(AuditEvent(
        team_id=team.id,
        event_type="heist_extracted",
        payload=json.dumps({
            "final_score": final_score,
            "stage_scores": stage_scores_sum,
            "penalties": total_penalties,
            "remaining_seconds": remaining_seconds,
        }),
    ))

    db.commit()

    return {
        "success": True,
        "message": "EXTRACTION COMPLETE! Vault bypassed, getaway secured.",
        "final_score": final_score,
        "breakdown": {
            "stage_scores_sum": stage_scores_sum,
            "total_penalties": total_penalties,
            "remaining_money": team.money,
            "accumulated_risk": team.risk,
            "remaining_seconds": remaining_seconds,
        },
    }
