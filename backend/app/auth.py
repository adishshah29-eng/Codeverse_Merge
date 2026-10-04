import json
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
import httpx
import jwt
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuditEvent, StageProgress, Team
from .settings import settings

ALGORITHM = "HS256"
COOKIE_NAME = "heist_token"


def create_token(sub: str, role: str, extra: dict | None = None) -> str:
    if not settings.secret_key:
        raise HTTPException(status_code=503, detail="Token signing is not configured")
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=18),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    if not settings.secret_key:
        raise HTTPException(status_code=503, detail="Token signing is not configured")
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session") from exc


def get_token(heist_token: Annotated[str | None, Cookie()] = None) -> str | None:
    return heist_token


def current_team(
    token: Annotated[str | None, Depends(get_token)],
    db: Session = Depends(get_db),
) -> Team:
    if not token:
        db.add(AuditEvent(team_id=None, event_type="team_auth_missing_token", payload="{}"))
        db.commit()
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        user_id = get_supabase_user_id(token)
    except HTTPException as exc:
        db.add(AuditEvent(
            team_id=None,
            event_type="team_auth_failed",
            payload=json.dumps({"status_code": exc.status_code}),
        ))
        db.commit()
        raise
    team = db.query(Team).filter(Team.supabase_user_id == user_id).one_or_none()
    if not team:
        db.add(AuditEvent(
            team_id=None,
            event_type="team_auth_unassigned",
            payload=json.dumps({"user_id": user_id}),
        ))
        db.commit()
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
            db.add(AuditEvent(
                team_id=team.id,
                event_type="unauthorized_stage_access",
                payload=json.dumps({"requested_stage": stage_id, "current_stage": team.current_stage}),
            ))
            db.commit()
            raise HTTPException(status_code=403, detail="This stage is locked")
        progress = db.query(StageProgress).filter(
            StageProgress.team_id == team.id,
            StageProgress.stage == stage_id,
        ).one_or_none()
        if progress and progress.status == "skipped":
            db.add(AuditEvent(
                team_id=team.id,
                event_type="unauthorized_stage_access",
                payload=json.dumps({"requested_stage": stage_id, "reason": "skipped"}),
            ))
            db.commit()
            raise HTTPException(status_code=403, detail="This stage was skipped")
        if progress and progress.status == "completed" and request.method != "GET":
            db.add(AuditEvent(
                team_id=team.id,
                event_type="unauthorized_stage_access",
                payload=json.dumps({"requested_stage": stage_id, "reason": "already_completed"}),
            ))
            db.commit()
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
