import hashlib
import json
import time
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


_user_cache: dict[str, tuple[str, float]] = {}
_USER_CACHE_TTL = 60.0
_USER_CACHE_MAX = 5000
_jwks_client = None


def _jwks():
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
            lifespan=3600,
        )
    return _jwks_client


def _verify_supabase_jwt_locally(token: str) -> str | None:
    """Verify a Supabase access token without a network round trip.

    Returns the user id, or None when local verification is not possible
    (no secret / unknown algorithm), in which case the caller falls back to
    asking Supabase directly.
    """
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase session") from exc

    try:
        if alg == "HS256":
            if not settings.supabase_jwt_secret:
                return None
            claims = jwt.decode(token, settings.supabase_jwt_secret, algorithms=["HS256"], audience="authenticated")
        elif alg in ("ES256", "RS256"):
            signing_key = _jwks().get_signing_key_from_jwt(token)
            claims = jwt.decode(token, signing_key.key, algorithms=[alg], audience="authenticated")
        else:
            return None
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Supabase session") from exc
    except jwt.PyJWKClientError:
        return None
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired Supabase session") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid Supabase session")
    return user_id


def get_supabase_user_id(token: str) -> str:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase Auth is not configured")

    user_id = _verify_supabase_jwt_locally(token)
    if user_id:
        return user_id

    cache_key = hashlib.sha256(token.encode()).hexdigest()
    cached = _user_cache.get(cache_key)
    now = time.monotonic()
    if cached and cached[1] > now:
        return cached[0]

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

    if len(_user_cache) >= _USER_CACHE_MAX:
        _user_cache.clear()
    _user_cache[cache_key] = (user_id, now + _USER_CACHE_TTL)
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
