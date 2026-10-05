"""Which competition phases are currently open to teams.

Controlled by the `active_phases` config key (e.g. "1", "2" or "1,2"), which
organizers can change at runtime from the admin dashboard's configuration
panel. Admin endpoints are never gated.
"""
import time

from fastapi import HTTPException

from .db import SessionLocal
from .models import ConfigKV

ACTIVE_PHASES_KEY = "active_phases"
DEFAULT_ACTIVE_PHASES = "1,2"
_CACHE_TTL = 5.0
_cache: tuple[set[int], float] | None = None


def parse_phases(value: str) -> set[int]:
    phases = set()
    for part in (value or "").split(","):
        part = part.strip()
        if part.isdigit():
            phases.add(int(part))
    return phases


def active_phases() -> set[int]:
    global _cache
    now = time.monotonic()
    if _cache and _cache[1] > now:
        return _cache[0]
    db = SessionLocal()
    try:
        row = db.query(ConfigKV).filter(ConfigKV.key == ACTIVE_PHASES_KEY).one_or_none()
        phases = parse_phases(row.value if row else DEFAULT_ACTIVE_PHASES)
    finally:
        db.close()
    _cache = (phases, now + _CACHE_TTL)
    return phases


def require_phase(phase: int):
    def check_phase() -> None:
        if phase not in active_phases():
            raise HTTPException(status_code=403, detail=f"Phase {phase} is not open right now.")

    return check_phase
