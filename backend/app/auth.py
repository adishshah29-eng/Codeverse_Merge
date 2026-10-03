from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
import httpx
import jwt
from sqlalchemy.orm import Session

from .db import get_db
from .models import StageProgress, Team
from .settings import settings

ALGORITHM = "HS256"
COOKIE_NAME = "heist_token"


def create_token(sub: str, role: str, extra: dict | None = None) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=18),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc


def get_token(
    authorization: Annotated[str | None, Header()] = None,
    heist_token: Annotated[str | None, Cookie()] = None,
) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return heist_token


def current_team(
    token: Annotated[str | None, Depends(get_token)],
    db: Session = Depends(get_db),
) -> Team:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = get_supabase_user_id(token)
    team = db.query(Team).filter(Team.supabase_user_id == user_id).one_or_none()
    if not team:
        raise HTTPException(status_code=403, detail="No team is assigned to this account")
    return team


def get_supabase_user_id(token: str) -> str:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured")

    try:
        response = httpx.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {token}",
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Supabase Auth is unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Supabase session")

    user_id = response.json().get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid Supabase session")
    return user_id


def require_stage(stage_id: int):
    def check_stage(
        request: Request,
        team: Annotated[Team, Depends(current_team)],
        db: Session = Depends(get_db),
    ) -> Team:
        if team.current_stage != stage_id:
            raise HTTPException(status_code=403, detail="This stage is locked")
        progress = db.query(StageProgress).filter(
            StageProgress.team_id == team.id,
            StageProgress.stage == stage_id,
        ).one_or_none()
        if progress and progress.status == "skipped":
            raise HTTPException(status_code=403, detail="This stage was skipped")
        if progress and progress.status == "completed" and request.method != "GET":
            raise HTTPException(status_code=403, detail="This stage is already complete")
        return team

    return check_stage


def optional_team(
    token: Annotated[str | None, Depends(get_token)],
    db: Session = Depends(get_db),
) -> Team | None:
    if not token:
        return None
    try:
        user_id = get_supabase_user_id(token)
    except HTTPException:
        return None
    return db.query(Team).filter(Team.supabase_user_id == user_id).one_or_none()


def current_admin(
    token: Annotated[str | None, Depends(get_token)],
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = decode_token(token)
    if data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin session required")
    return data
