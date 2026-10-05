from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import current_admin

from app.phase1.core.config import settings
from app.phase1.core.database import (
    decode_json,
    delete_rows,
    get_store,
    get_scoring_config,
    log_audit,
    select_rows,
    update_scoring_config,
    update_rows,
)
from app.phase1.core.engine import ProgressionEngine

router = APIRouter(prefix="/admin", tags=["Admin Portal"])


@router.get("/teams")
def admin_list_teams(admin: dict = Depends(current_admin)):
    teams = select_rows("p1_teams")
    teams.sort(key=lambda team: (-float(team["total_score"]), team["updated_at"]))
    progress_rows = select_rows("p1_stage_progress")
    submission_rows = get_store().table("p1_submissions").select("team_id").execute().data or []

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
            "core_team_id": team.get("core_team_id"),
            "is_active": bool(team["is_active"]),
            "current_stage": team["current_stage"],
            "total_score": float(team["total_score"]),
            "total_penalty": float(team["total_penalty"]),
            "created_at": team["created_at"],
            "updated_at": team["updated_at"],
            "submissions_count": submission_counts.get(team["id"], 0),
            "stages": stages,
        })
    return {"p1_teams": team_list}


@router.post("/teams")
def admin_add_team(payload: Dict[str, str], admin: dict = Depends(current_admin)):
    # Team accounts are platform-wide (one login for all phases) and are created from the
    # main admin dashboard. A team's Phase 1 record appears on its first visit.
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Create team accounts in the main admin dashboard (TEAM ACCOUNTS). They appear here once the team opens Phase 1.",
    )


@router.patch("/teams/{team_id}")
def admin_update_team(team_id: str, payload: Dict[str, Any], admin: dict = Depends(current_admin)):
    if "is_active" in payload:
        update_rows("p1_teams", {"id": team_id}, {"is_active": bool(payload["is_active"])})
    if "reset_stage" in payload:
        try:
            reset_stage = int(payload["reset_stage"])
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="reset_stage must be a stage number.")
        if not 1 <= reset_stage <= settings.TOTAL_STAGES:
            raise HTTPException(status_code=422, detail=f"reset_stage must be between 1 and {settings.TOTAL_STAGES}.")
        ProgressionEngine.admin_reset_team(team_id, reset_stage)
    log_audit("ADMIN_UPDATE_TEAM", payload, team_id=team_id)
    return {"success": True, "message": "Team updated successfully."}


@router.delete("/teams/{team_id}")
def admin_delete_team(team_id: str, admin: dict = Depends(current_admin)):
    # Removes the team's Phase 1 progress only; the platform account is kept
    # and a fresh Phase 1 record is created if the team opens Phase 1 again.
    delete_rows("p1_teams", {"id": team_id})
    log_audit("ADMIN_DELETE_TEAM", {"team_id": team_id})
    return {"success": True, "message": "Team's Phase 1 record deleted."}


@router.get("/config")
def admin_get_config(admin: dict = Depends(current_admin)):
    return {"scoring_config": get_scoring_config()}


@router.put("/config")
def admin_update_config(payload: Dict[str, Any], admin: dict = Depends(current_admin)):
    if not all(isinstance(value, dict) for value in payload.values()):
        raise HTTPException(status_code=422, detail="Scoring config must map game keys to objects.")
    new_config = update_scoring_config(payload)
    log_audit("ADMIN_CONFIG_UPDATED", payload)
    return {"success": True, "scoring_config": new_config}


@router.get("/audit-logs")
def admin_get_audit_logs(admin: dict = Depends(current_admin)):
    rows = get_store().table("p1_audit_logs").select("*").order("created_at", desc=True).limit(100).execute().data or []
    return {"logs": [{
        "id": row["id"],
        "team_id": row["team_id"],
        "action": row["action"],
        "details": decode_json(row["details"], {}),
        "created_at": row["created_at"],
    } for row in rows]}