from fastapi import APIRouter, Header, HTTPException, status
from typing import Optional
from core.models import TeamDashboardResponse, SkipStageRequest, HintRequest
from core.engine import ProgressionEngine

router = APIRouter(prefix="/progress", tags=["Progression"])

def extract_team_id(x_team_id: Optional[str] = Header(None)) -> str:
    if not x_team_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header 'X-Team-ID' is required."
        )
    return x_team_id.strip()

@router.get("/dashboard", response_model=TeamDashboardResponse)
def get_dashboard(x_team_id: Optional[str] = Header(None)):
    team_id = extract_team_id(x_team_id)
    return ProgressionEngine.get_team_dashboard(team_id)

@router.post("/skip")
def skip_current_stage(payload: SkipStageRequest, x_team_id: Optional[str] = Header(None)):
    team_id = extract_team_id(x_team_id)
    return ProgressionEngine.skip_stage(team_id, payload.stage_id)

@router.post("/hint")
def request_hint(payload: HintRequest, x_team_id: Optional[str] = Header(None)):
    team_id = extract_team_id(x_team_id)
    return ProgressionEngine.unlock_hint(team_id, payload.stage_id, payload.hint_index)
