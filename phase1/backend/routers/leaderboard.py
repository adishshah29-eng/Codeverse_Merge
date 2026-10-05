from fastapi import APIRouter
from core.models import LeaderboardResponse
from core.engine import ProgressionEngine

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

@router.get("", response_model=LeaderboardResponse)
def get_leaderboard():
    return ProgressionEngine.get_leaderboard()
