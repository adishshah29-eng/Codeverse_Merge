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
from ..models import AuditEvent, GameOutput, Penalty, StageProgress, Submission, Team

router = APIRouter(
    prefix="/api/extraction",
    tags=["extraction"],
    dependencies=[Depends(require_stage(4))],
)
EXTRACTION_DURATION_SECONDS = 300


@router.get("/status")
def get_extraction_status(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    outputs = db.query(GameOutput).filter(GameOutput.team_id == team.id).all()
    output_dict = {o.key: o.value for o in outputs}

    progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 4,
    ).one_or_none()

    return {
        "success": True,
        "team_code": team.code,
        "team_name": team.name,
        "money": team.money,
        "risk": team.risk,
        "outputs_acquired": output_dict,
        "completed": progress.status == "completed" if progress else False,
        "final_score": team.final_score,
    }


class VerifyArtifactsRequest(BaseModel):
    deletion_key: str
    shutdown_code: str
    control_token: str
    route_code: str


@router.post("/verify-artifacts")
def verify_extraction_artifacts(
    req: VerifyArtifactsRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    outputs = db.query(GameOutput).filter(GameOutput.team_id == team.id).all()
    output_dict = {o.key: o.value for o in outputs}

    result = verify_artifacts(
        req.deletion_key,
        req.shutdown_code,
        req.control_token,
        req.route_code,
        output_dict,
    )

    # Audit validation attempt
    db.add(AuditEvent(
        team_id=team.id,
        event_type="extraction_artifacts_checked",
        payload=json.dumps({"all_valid": result["all_valid"]}),
    ))
    db.commit()

    time_remaining = None
    if result["all_valid"]:
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
        time_remaining = max(0, EXTRACTION_DURATION_SECONDS - elapsed)

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
    elapsed = max(0, int((datetime.now(timezone.utc) - verified_at).total_seconds()))
    remaining_seconds = max(0, EXTRACTION_DURATION_SECONDS - elapsed)

    ok, message = verify_sequence_order(req.sequence)
    if not ok:
        # Deduct penalty for wrong sequence attempt
        penalty = Penalty(
            team_id=team.id,
            reason="Incorrect Final Extraction Sequence Order",
            amount=1.5,
            source="extraction_wrong_sequence",
        )
        db.add(penalty)
        db.commit()
        return {"success": False, "message": message, "penalty_applied": 1.5}

    # Sequence succeeded! Mark Stage 4 complete with 10.0 points
    progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 4,
    ).one_or_none()

    if not progress:
        progress = StageProgress(team_id=team.id, stage=4, status="completed", score=10.0)
        db.add(progress)
    else:
        progress.status = "completed"
        progress.score = 10.0
        progress.updated_at = datetime.utcnow()

    # Calculate authoritative final event score
    all_progress = db.query(StageProgress).filter(StageProgress.team_id == team.id).all()
    stage_scores_sum = sum(p.score for p in all_progress)

    all_penalties = db.query(Penalty).filter(Penalty.team_id == team.id).all()
    total_penalties = sum(p.amount for p in all_penalties)

    final_score = calculate_final_heist_score(
        stage_scores_sum=stage_scores_sum,
        total_penalties=total_penalties,
        remaining_money=team.money,
        accumulated_risk=team.risk,
        remaining_time_seconds=remaining_seconds,
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
