from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import COOKIE_NAME, create_token, current_team, current_admin, get_token, hash_password, verify_password
from ..db import get_db
from ..models import Team, StageProgress
from ..settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    code: str
    password: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def team_login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    code = req.code.strip().upper()
    team = db.query(Team).filter(Team.code == code).one_or_none()
    if not team or not verify_password(req.password, team.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid team credentials")

    if not team.event_started_at:
        team.event_started_at = datetime.utcnow()
        db.commit()

    token = create_token(sub=team.code, role="team")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=False,
        samesite="lax",
        max_age=86400,
    )
    return {
        "success": True,
        "token": token,
        "role": "team",
        "team": {
            "id": team.id,
            "code": team.code,
            "name": team.name,
            "current_stage": team.current_stage,
            "money": team.money,
            "risk": team.risk,
        },
    }


@router.post("/admin-login")
def admin_login(req: AdminLoginRequest, response: Response):
    if req.username != settings.admin_username or req.password != settings.admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    token = create_token(sub=req.username, role="admin")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=False,
        samesite="lax",
        max_age=86400,
    )
    return {
        "success": True,
        "token": token,
        "role": "admin",
        "username": req.username,
    }


@router.get("/me")
def get_current_user_profile(
    token_str: str | None = Depends(get_token),
    db: Session = Depends(get_db),
):
    if not token_str:
        return {"authenticated": False}

    from ..auth import decode_token
    try:
        data = decode_token(token_str)
    except HTTPException:
        return {"authenticated": False}

    role = data.get("role")
    if role == "admin":
        return {
            "authenticated": True,
            "role": "admin",
            "username": data.get("sub"),
        }
    elif role == "team":
        team = db.query(Team).filter(Team.code == data.get("sub")).one_or_none()
        if not team:
            return {"authenticated": False}

        # Query stage progress
        progress_rows = db.query(StageProgress).filter(StageProgress.team_id == team.id).all()
        completed = [p.stage for p in progress_rows if p.status == "completed"]
        skipped = [p.stage for p in progress_rows if p.status == "skipped"]
        scores = {p.stage: p.score for p in progress_rows}

        return {
            "authenticated": True,
            "role": "team",
            "team": {
                "id": team.id,
                "code": team.code,
                "name": team.name,
                "money": team.money,
                "risk": team.risk,
                "current_stage": team.current_stage,
                "completed_stages": completed,
                "skipped_stages": skipped,
                "stage_scores": scores,
                "final_score": team.final_score,
                "black_market_unlocked": team.black_market_unlocked,
                "black_market_purchases": team.black_market_purchases,
            },
        }

    return {"authenticated": False}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"success": True, "message": "Logged out successfully"}
