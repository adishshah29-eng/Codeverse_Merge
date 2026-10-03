from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
import jwt
from passlib.hash import pbkdf2_sha256
from sqlalchemy.orm import Session

from .db import get_db
from .models import Team
from .settings import settings

ALGORITHM = "HS256"
COOKIE_NAME = "heist_token"


def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pbkdf2_sha256.verify(password, hashed)


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
    data = decode_token(token)
    if data.get("role") != "team":
        raise HTTPException(status_code=403, detail="Team session required")
    team = db.query(Team).filter(Team.code == data["sub"]).one_or_none()
    if not team:
        raise HTTPException(status_code=401, detail="Unknown team")
    return team


def optional_team(
    token: Annotated[str | None, Depends(get_token)],
    db: Session = Depends(get_db),
) -> Team | None:
    if not token:
        return None
    try:
        data = decode_token(token)
    except HTTPException:
        return None
    if data.get("role") != "team":
        return None
    return db.query(Team).filter(Team.code == data["sub"]).one_or_none()


def current_admin(
    token: Annotated[str | None, Depends(get_token)],
) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    data = decode_token(token)
    if data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin session required")
    return data
