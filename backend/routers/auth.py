from fastapi import APIRouter, HTTPException, status
from core.models import TeamRegisterRequest, TeamLoginRequest, AdminLoginRequest
from core.engine import ProgressionEngine
from core.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register")
def register_team(req: TeamRegisterRequest):
    team = ProgressionEngine.get_or_create_team(req.name, req.passcode)
    return {
        "success": True,
        "team": {
            "id": team["id"],
            "name": team["name"],
            "current_stage": team["current_stage"],
            "total_score": team["total_score"]
        }
    }

@router.post("/login")
def login_team(req: TeamLoginRequest):
    team = ProgressionEngine.get_or_create_team(req.name, req.passcode)
    return {
        "success": True,
        "team": {
            "id": team["id"],
            "name": team["name"],
            "current_stage": team["current_stage"],
            "total_score": team["total_score"]
        }
    }

@router.post("/admin-login")
def login_admin(req: AdminLoginRequest):
    if req.passcode.strip() != settings.ADMIN_PASSCODE.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid administrative security passcode."
        )
    return {
        "success": True,
        "role": "admin",
        "message": "Administrative access granted."
    }
