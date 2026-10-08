import json
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, status
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


def team_id_from_token(token: str) -> tuple[int, str]:
    """Return (team id, team code) from a team session token, or raise 401."""
    data = decode_token(token)
    if data.get("role") != "team":
        raise HTTPException(status_code=401, detail="Team session required")
    try:
        return int(data["sub"]), str(data["code"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid session") from exc


def team_for_token(token: str, db: Session) -> Team | None:
    team_id, code = team_id_from_token(token)
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    # The code check stops a token for a deleted team from matching a new
    # team that happens to reuse the same numeric id.
    if not team or team.code != code:
        return None
    return team


def current_team(
    token: Annotated[str | None, Depends(get_token)],
    db: Session = Depends(get_db),
) -> Team:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        team = team_for_token(token, db)
    except HTTPException as exc:
        db.add(AuditEvent(
            team_id=None,
            event_type="team_auth_failed",
            payload=json.dumps({"status_code": exc.status_code}),
        ))
        db.commit()
        raise
    if not team:
        raise HTTPException(status_code=401, detail="This team account no longer exists")
    return team


def require_stage(stage_id: int):
    def check_stage(
        request: Request,
        team: Annotated[Team, Depends(current_team)],
        db: Session = Depends(get_db),
    ) -> Team:
        if settings.debug_unlock_all:      # debug mode: every stage is open and replayable
            return team
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
        return team_for_token(token, db)
    except HTTPException:
        return None


def current_admin(
    token: Annotated[str | None, Depends(get_token)],
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = decode_token(token)
    if data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin session required")
    return data
