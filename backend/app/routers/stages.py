from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team
from ..db import get_db
from ..models import AuditEvent, ConfigKV, GameOutput, Penalty, StageProgress, Team

router = APIRouter(prefix="/api/stages", tags=["stages"])

STAGE_SCORE_KEYS = {
    1: "stage1_max_score",
    2: "stage2_max_score",
    3: "police_max_score",
    4: "stage4_max_score",
}

STAGE_METADATA = [
    {
        "id": 1,
        "slug": "money-trail",
        "title": "Stage 1 — Erase the Money Trail",
        "category": "Data Forensics & SQL",
        "description": "Cross-reference transaction registries, employee card swipes, terminal session histories, and security logs to eliminate decoys and forge the master Deletion Key.",
        "output_key": "deletion_key",
        "output_name": "Deletion Key",
    },
    {
        "id": 2,
        "slug": "control-server",
        "title": "Stage 2 — Find the Control Server",
        "category": "Web & API Forensics",
        "description": "Infiltrate IronVault internal teller portals, bypass client-side fraud shields, and inspect raw HTTP telemetry headers to capture the command Control Token.",
        "output_key": "control_token",
        "output_name": "Control Token",
    },
    {
        "id": 3,
        "slug": "outrun-police",
        "title": "Stage 3 — Outrun the Police",
        "category": "Graph Optimization & Routing",
        "description": "Navigate a dynamic metropolitan escape network across 60 checkpoints under closing road windows, compromised nodes, and competing time/risk budgets.",
        "output_key": "route_code",
        "output_name": "Escape Route Code",
    },
    {
        "id": 4,
        "slug": "final-extraction",
        "title": "Stage 4 — Final Extraction",
        "category": "Systems Integration & Execution",
        "description": "Arm the 4 required cryptographic artifacts, execute the 5-step master override sequence, and pilot the getaway crew through the underground transit tunnels.",
        "output_key": "final_score",
        "output_name": "Extraction Score",
    },
]


def get_skip_penalty(db: Session) -> float:
    kv = db.query(ConfigKV).filter(ConfigKV.key == "stage_skip_penalty").one_or_none()
    if not kv:
        raise HTTPException(status_code=503, detail="Stage configuration is unavailable")
    try:
        return float(kv.value)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Stage configuration is invalid") from exc


def get_stage_max_score(db: Session, stage_id: int) -> float:
    key = STAGE_SCORE_KEYS[stage_id]
    kv = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if not kv:
        raise HTTPException(status_code=503, detail="Stage score configuration is unavailable")
    try:
        return float(kv.value)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Stage score configuration is invalid") from exc


@router.get("")
def get_stages(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    progress_rows = db.query(StageProgress).filter(StageProgress.team_id == team.id).all()
    progress_by_stage = {p.stage: p for p in progress_rows}

    # Query outputs — only used to determine acquired/not-acquired (NOT to return values)
    outputs = db.query(GameOutput).filter(GameOutput.team_id == team.id).all()
    acquired_keys = {o.key for o in outputs}

    result = []
    for meta in STAGE_METADATA:
        s_id = meta["id"]
        p = progress_by_stage.get(s_id)
        status = p.status if p else ("open" if s_id <= team.current_stage else "locked")
        score = p.score if p else 0.0

        result.append({
            **meta,
            "max_score": get_stage_max_score(db, s_id),
            "status": status,
            "score": score,
            # SECURITY: boolean flag only, NOT the actual key value
            "output_acquired": meta["output_key"] in acquired_keys,
            "is_current": (s_id == team.current_stage),
        })

    return {
        "success": True,
        "current_stage": team.current_stage,
        "skip_penalty": get_skip_penalty(db),
        "stages": result,
    }


class SkipStageRequest(BaseModel):
    confirm: bool = True


@router.post("/{stage_id}/skip")
def skip_stage(
    stage_id: int,
    req: SkipStageRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    if stage_id < 1 or stage_id > 4:
        raise HTTPException(status_code=400, detail="Invalid stage ID")

    if stage_id != team.current_stage:
        raise HTTPException(status_code=400, detail="Can only skip the active current stage")

    progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == stage_id,
    ).one_or_none()

    if progress and progress.status in ["completed", "skipped"]:
        raise HTTPException(status_code=400, detail=f"Stage {stage_id} is already {progress.status}")

    penalty_amount = get_skip_penalty(db)

    # 1. Update/create stage progress as skipped with 0 score
    if not progress:
        progress = StageProgress(team_id=team.id, stage=stage_id, status="skipped", score=0.0)
        db.add(progress)
    else:
        progress.status = "skipped"
        progress.score = 0.0
        progress.updated_at = datetime.utcnow()

    # 2. Record penalty
    penalty = Penalty(
        team_id=team.id,
        reason=f"Skipped Stage 0{stage_id}",
        amount=penalty_amount,
        source=f"stage_{stage_id}_skip",
    )
    db.add(penalty)

    # 3. Supply synthetic fallback output so downstream stages remain unlockable
    fallback_outputs = {
        1: ("deletion_key", "STAGE-01-SKIPPED"),
        2: ("control_token", "STAGE-02-SKIPPED"),
        3: ("route_code", "STAGE-03-SKIPPED"),
    }
    if stage_id in fallback_outputs:
        k, v = fallback_outputs[stage_id]
        existing_out = db.query(GameOutput).filter(GameOutput.team_id == team.id, GameOutput.key == k).one_or_none()
        if not existing_out:
            db.add(GameOutput(team_id=team.id, key=k, value=v))

    # 4. Advance team current stage
    team.current_stage = min(4, team.current_stage + 1)

    # 5. Audit event
    db.add(AuditEvent(
        team_id=team.id,
        event_type="stage_skipped",
        payload=f'{{"stage": {stage_id}, "penalty": {penalty_amount}}}',
    ))

    db.commit()

    return {
        "success": True,
        "message": f"Stage {stage_id} skipped. Penalty of -{penalty_amount} pts applied.",
        "new_current_stage": team.current_stage,
        "penalty_applied": penalty_amount,
    }
