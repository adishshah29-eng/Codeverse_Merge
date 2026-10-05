"""Request dependencies that connect Phase 1 to the platform login."""
from fastapi import Depends

from app.auth import current_team
from app.models import Team
from app.phase1.core.engine import ProgressionEngine


def phase1_team_id(team: Team = Depends(current_team)) -> str:
    """Resolve the caller's Phase 1 team id from their verified session cookie.

    Replaces the old X-Team-ID header, which any client could forge.
    """
    return ProgressionEngine.get_or_create_team_for_core(team.id, team.name)["id"]
