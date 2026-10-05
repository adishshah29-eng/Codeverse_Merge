from typing import Any, Dict, Optional

from fastapi import APIRouter, Header, HTTPException, status

from core.config import settings
from core.database import (
    decode_json,
    delete_rows,
    get_supabase,
    get_scoring_config,
    log_audit,
    select_rows,
    update_scoring_config,
    update_rows,
)
from core.engine import ProgressionEngine

router = APIRouter(prefix="/admin", tags=["Admin Portal"])


def verify_admin(x_admin_token: Optional[str] = Header(None)):
    if not x_admin_token or x_admin_token.strip() != settings.ADMIN_PASSCODE.strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized: Admin passcode required.")


@router.get("/teams")
def admin_list_teams(x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    teams = select_rows("teams")
    teams.sort(key=lambda team: (-float(team["total_score"]), team["updated_at"]))
    progress_rows = select_rows("stage_progress")
    submission_rows = get_supabase().table("submissions").select("team_id").execute().data or []

    progress_by_team: Dict[str, list] = {}
    submission_counts: Dict[str, int] = {}
    for progress in progress_rows:
        progress_by_team.setdefault(progress["team_id"], []).append(progress)
    for submission in submission_rows:
        submission_counts[submission["team_id"]] = submission_counts.get(submission["team_id"], 0) + 1

    team_list = []
    for team in teams:
        stages = [{
            "stage_id": progress["stage_id"],
            "status": progress["status"],
            "score": float(progress["score"]),
            "started_at": progress["started_at"],
            "completed_at": progress["completed_at"],
            "attempts_count": progress["attempts_count"],
            "wrong_attempts": progress["wrong_attempts"],
            "hints_used": decode_json(progress["hints_used"], []),
            "penalty_points": float(progress["penalty_points"]),
            "metadata": decode_json(progress["metadata"], {}),
        } for progress in sorted(progress_by_team.get(team["id"], []), key=lambda row: row["stage_id"])]
        team_list.append({
            "id": team["id"],
            "name": team["name"],
            "passcode": team["passcode"],
            "is_active": bool(team["is_active"]),
            "current_stage": team["current_stage"],
            "total_score": float(team["total_score"]),
            "total_penalty": float(team["total_penalty"]),
            "created_at": team["created_at"],
            "updated_at": team["updated_at"],
            "submissions_count": submission_counts.get(team["id"], 0),
            "stages": stages,
        })
    return {"teams": team_list}


@router.post("/teams")
def admin_add_team(payload: Dict[str, str], x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    name = payload.get("name")
    passcode = payload.get("passcode")
    if not name or not passcode:
        raise HTTPException(status_code=400, detail="Team name and passcode required.")
    team = ProgressionEngine.get_or_create_team(name, passcode)
    return {"success": True, "team": team}


@router.patch("/teams/{team_id}")
def admin_update_team(team_id: str, payload: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    if "is_active" in payload:
        update_rows("teams", {"id": team_id}, {"is_active": bool(payload["is_active"])})
    if "reset_stage" in payload:
        ProgressionEngine.admin_reset_team(team_id, int(payload["reset_stage"]))
    log_audit("ADMIN_UPDATE_TEAM", payload, team_id=team_id)
    return {"success": True, "message": "Team updated successfully."}


@router.delete("/teams/{team_id}")
def admin_delete_team(team_id: str, x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    delete_rows("teams", {"id": team_id})
    log_audit("ADMIN_DELETE_TEAM", {"team_id": team_id})
    return {"success": True, "message": "Team deleted."}


@router.get("/config")
def admin_get_config(x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    return {"scoring_config": get_scoring_config()}


@router.put("/config")
def admin_update_config(payload: Dict[str, Any], x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    new_config = update_scoring_config(payload)
    log_audit("ADMIN_CONFIG_UPDATED", payload)
    return {"success": True, "scoring_config": new_config}


@router.get("/audit-logs")
def admin_get_audit_logs(x_admin_token: Optional[str] = Header(None)):
    verify_admin(x_admin_token)
    rows = get_supabase().table("audit_logs").select("*").order("created_at", desc=True).limit(100).execute().data or []
    return {"logs": [{
        "id": row["id"],
        "team_id": row["team_id"],
        "action": row["action"],
        "details": decode_json(row["details"], {}),
        "created_at": row["created_at"],
    } for row in rows]}