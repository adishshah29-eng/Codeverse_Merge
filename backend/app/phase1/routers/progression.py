from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from app.phase1.core.models import TeamDashboardResponse, SkipStageRequest, HintRequest
from app.phase1.core.engine import ProgressionEngine
from app.phase1.deps import phase1_team_id

router = APIRouter(prefix="/progress", tags=["Progression"])

@router.get("/dashboard", response_model=TeamDashboardResponse)
def get_dashboard(team_id: str = Depends(phase1_team_id)):
    return ProgressionEngine.get_team_dashboard(team_id)

@router.post("/skip")
def skip_current_stage(payload: SkipStageRequest, team_id: str = Depends(phase1_team_id)):
    return ProgressionEngine.skip_stage(team_id, payload.stage_id)

@router.post("/hint")
def request_hint(payload: HintRequest, team_id: str = Depends(phase1_team_id)):
    return ProgressionEngine.unlock_hint(team_id, payload.stage_id, payload.hint_index)
