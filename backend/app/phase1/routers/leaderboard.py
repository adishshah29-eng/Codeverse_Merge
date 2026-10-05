from fastapi import APIRouter
from app.phase1.core.models import LeaderboardResponse
from app.phase1.core.engine import ProgressionEngine

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

@router.get("", response_model=LeaderboardResponse)
def get_leaderboard():
    return ProgressionEngine.get_leaderboard()
