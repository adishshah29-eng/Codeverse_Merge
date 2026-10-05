import hmac
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import COOKIE_NAME, team_for_token, create_token, decode_token, get_token
from ..passwords import DUMMY_HASH, verify_password
from ..db import get_db
from ..models import AuditEvent, Team, StageProgress
from ..settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class AdminLoginRequest(BaseModel):
    username: str = Field(max_length=128)
    password: str = Field(max_length=256)


@router.post("/login")
def team_login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    team = db.query(Team).filter(Team.email == email).one_or_none()
    # Always run one hash check so response time does not reveal valid emails.
    password_ok = verify_password(req.password, team.password_hash if team else DUMMY_HASH)
    profile = None
    if team and password_ok:
        profile = {
            "id": team.id,
            "code": team.code,
            "name": team.name,
            "current_stage": team.current_stage,
            "money": team.money,
            "risk": team.risk,
        }
    # End the read transaction before writing. The slow password check above
    # must never run while this request holds the SQLite write lock.
    db.rollback()

    if not profile:
        db.add(AuditEvent(
            team_id=None,
            event_type="team_login_failed",
            payload=json.dumps({"email": email[:254]}),
        ))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid team credentials")

    db.query(Team).filter(Team.id == profile["id"], Team.event_started_at.is_(None)).update(
        {Team.event_started_at: datetime.utcnow()}, synchronize_session=False
    )
    db.add(AuditEvent(team_id=profile["id"], event_type="team_login_success", payload="{}"))
    db.commit()

    token = create_token(sub=str(profile["id"]), role="team", extra={"code": profile["code"]})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=86400,
    )
    return {"success": True, "role": "team", "team": profile}


@router.post("/admin-login")
def admin_login(req: AdminLoginRequest, response: Response, db: Session = Depends(get_db)):
    if not settings.admin_username or not settings.admin_password:
        raise HTTPException(status_code=503, detail="Admin credentials are not configured")

    username_ok = hmac.compare_digest(req.username.encode(), settings.admin_username.encode())
    password_ok = hmac.compare_digest(req.password.encode(), settings.admin_password.encode())
    if not (username_ok and password_ok):
        # Log failed admin login attempt
        db.add(AuditEvent(
            team_id=None,
            event_type="admin_login_failed",
            payload=json.dumps({"username": req.username[:64]}),
        ))
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")

    token = create_token(sub=req.username, role="admin")
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=86400,
    )

    # Log successful admin login
    db.add(AuditEvent(
        team_id=None,
        event_type="admin_login_success",
        payload=json.dumps({"username": req.username[:64]}),
    ))
    db.commit()

    return {
        "success": True,
        # SECURITY: token NOT returned in body — it's in the httpOnly cookie
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

    try:
        data = decode_token(token_str)
        if data.get("role") == "admin":
            return {
                "authenticated": True,
                "role": "admin",
                "username": data.get("sub"),
            }
    except HTTPException:
        pass

    try:
        team = team_for_token(token_str, db)
    except HTTPException:
        return {"authenticated": False}
    if not team:
        return {"authenticated": False}

    if not team.event_started_at:
        team.event_started_at = datetime.utcnow()
        db.commit()

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
            "event_started_at": team.event_started_at.isoformat() if team.event_started_at else None,
            "black_market_unlocked": team.black_market_unlocked,
            "black_market_purchases": team.black_market_purchases,
        },
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, secure=settings.cookie_secure, httponly=True, samesite="lax")
    return {"success": True, "message": "Logged out successfully"}
