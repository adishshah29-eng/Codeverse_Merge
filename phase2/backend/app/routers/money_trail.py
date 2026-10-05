from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team, require_stage
from ..db import get_db
from ..games.money_trail.engine import execute_sql, verify_money_trail
from ..models import AuditEvent, ConfigKV, GameOutput, StageProgress, Submission, Team
from ..security import record_submission_attempt

router = APIRouter(
    prefix="/api/money_trail",
    tags=["money_trail"],
    dependencies=[Depends(require_stage(1))],
)

def _get_config(db: Session, key: str) -> str:
    row = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if not row:
        raise HTTPException(status_code=503, detail=f"Game configuration is missing: {key}")
    return row.value


@router.get("/schema")
def get_forensic_schema(team: Team = Depends(current_team)):
    """Returns database schema metadata for the forensics terminal."""
    return {
        "success": True,
        "tables": [
            {
                "name": "transactions",
                "description": "High-value wire transfers, inter-bank settlement ledgers, and terminal stamps.",
                "columns": ["txn_id", "timestamp", "sender_account", "recipient_account", "amount", "currency", "terminal_id", "status", "memo"],
            },
            {
                "name": "employees",
                "description": "Personnel registry including internal clearance levels and active security badges.",
                "columns": ["emp_id", "name", "role", "department", "clearance_level", "active_badge_id"],
            },
            {
                "name": "access_cards",
                "description": "Physical RFID badge swipe events across perimeter gates, vaults, and server rooms.",
                "columns": ["event_id", "badge_id", "emp_id", "door_location", "timestamp", "access_granted"],
            },
            {
                "name": "terminal_logs",
                "description": "Interactive CLI sessions, elevated privilege executions, and shell command histories.",
                "columns": ["log_id", "terminal_id", "emp_id", "login_time", "logout_time", "command_history", "ip_address"],
            },
            {
                "name": "security_events",
                "description": "Automated alarm triggers, sensor heartbeats, and biometric exception alerts.",
                "columns": ["event_id", "timestamp", "event_type", "location", "severity", "notes"],
            },
        ],
    }


class QueryRequest(BaseModel):
    query: str


@router.post("/query")
def run_forensic_query(
    req: QueryRequest,
    team: Team = Depends(current_team),
):
    """Executes read-only SQL forensic queries for the team."""
    success, columns, rows, error = execute_sql(req.query)
    if not success:
        return {"success": False, "error": error, "columns": [], "rows": []}

    return {
        "success": True,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
    }


class SubmitKeyRequest(BaseModel):
    deletion_key: str
    suspect_txn: str = ""


@router.post("/submit")
def submit_deletion_key(
    req: SubmitKeyRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    """Authoritative validation of Deletion Key for Stage 1."""

    # Idempotency guard — reject re-submission if already completed
    existing = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 1,
        StageProgress.status == "completed",
    ).one_or_none()
    if existing:
        return {
            "success": True,
            "message": "Stage 1 is already completed.",
            "already_completed": True,
            "score_awarded": existing.score,
        }

    record_submission_attempt(db, team.id, "stage_1_submission_attempt")

    # Read authoritative key from server config (never from client)
    correct_key = _get_config(db, "stage1_deletion_key")
    stage1_score = float(_get_config(db, "stage1_max_score"))

    is_valid, message, details = verify_money_trail(req.deletion_key, correct_key, req.suspect_txn)

    # Record submission (never store the correct answer itself)
    submission = Submission(
        team_id=team.id,
        stage="money_trail",
        accepted=is_valid,
        reason=message,
        payload=f'{{"txn": "{req.suspect_txn[:64]}"}}',
        score=stage1_score if is_valid else 0.0,
    )
    db.add(submission)

    if not is_valid:
        db.add(AuditEvent(
            team_id=team.id,
            event_type="stage_1_wrong_key",
            payload='{"result": "rejected"}',
        ))
        db.commit()
        return {"success": False, "message": message}

    # Success: award score from config
    progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 1,
    ).one_or_none()

    if not progress:
        progress = StageProgress(team_id=team.id, stage=1, status="completed", score=stage1_score)
        db.add(progress)
    else:
        progress.status = "completed"
        progress.score = stage1_score
        progress.updated_at = datetime.utcnow()

    # Store authoritative output for Stage 4 (the key the team proved they know)
    clean_key = req.deletion_key.strip().upper()
    output = db.query(GameOutput).filter(
        GameOutput.team_id == team.id,
        GameOutput.key == "deletion_key",
    ).one_or_none()
    if not output:
        db.add(GameOutput(team_id=team.id, key="deletion_key", value=clean_key))
    else:
        output.value = clean_key

    # Unlock next stage
    if team.current_stage == 1:
        team.current_stage = 2

    # Audit event — does NOT include the key value
    db.add(AuditEvent(
        team_id=team.id,
        event_type="stage_1_completed",
        payload=f'{{"score": {stage1_score}}}',
    ))

    db.commit()

    # Return success without revealing the key or other answers
    return {
        "success": True,
        "message": message,
        "score_awarded": stage1_score,
        "next_stage": team.current_stage,
    }
