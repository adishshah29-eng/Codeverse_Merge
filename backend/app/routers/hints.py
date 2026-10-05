from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team
from ..db import get_db
from ..models import AuditEvent, HintCatalog, HintUse, Penalty, Team

router = APIRouter(prefix="/api/hints", tags=["hints"])


@router.get("")
def get_hints_for_team(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    """
    Returns hints for the team.
    Only shows hints that are enabled by the organizer OR already unlocked by the team.
    """
    # 1. Hints already used by this team
    used_records = db.query(HintUse).filter(HintUse.team_id == team.id).all()
    used_hint_ids = {u.hint_id: u for u in used_records}

    # Hints from locked and completed stages are not exposed through the team API.
    all_hints = (
        db.query(HintCatalog)
        .filter(HintCatalog.stage == team.current_stage)
        .order_by(HintCatalog.sort_order)
        .all()
    )

    result = []
    for h in all_hints:
        is_used = h.id in used_hint_ids
        # Organizer release control: must be enabled by organizer to request, or already unlocked
        if not h.enabled and not is_used:
            continue

        result.append({
            "id": h.id,
            "stage": h.stage,
            "title": h.title,
            "body": h.body if is_used else None,  # Hidden until purchased/requested
            "penalty": h.penalty,
            "is_unlocked": is_used,
            "enabled": h.enabled,
        })

    return {
        "success": True,
        "hints": result,
    }


class RequestHintRequest(BaseModel):
    hint_id: str


@router.post("/request")
def request_hint(
    req: RequestHintRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    hint = db.query(HintCatalog).filter(HintCatalog.id == req.hint_id).one_or_none()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found in catalog")
    if hint.stage != team.current_stage:
        raise HTTPException(status_code=403, detail="This hint is not available for the active stage")

    if not hint.enabled:
        raise HTTPException(status_code=403, detail="This hint has not been released by the organizer yet")

    existing_use = db.query(HintUse).filter(
        HintUse.team_id == team.id,
        HintUse.hint_id == hint.id,
    ).one_or_none()

    if existing_use:
        return {
            "success": True,
            "already_unlocked": True,
            "hint": {
                "id": hint.id,
                "title": hint.title,
                "body": hint.body,
                "penalty": existing_use.penalty,
            },
        }

    # Record hint use
    hint_use = HintUse(
        team_id=team.id,
        hint_id=hint.id,
        penalty=hint.penalty,
        created_at=datetime.utcnow(),
    )
    db.add(hint_use)

    # Record penalty
    if hint.penalty > 0:
        penalty = Penalty(
            team_id=team.id,
            reason=f"Hint: {hint.title}",
            amount=hint.penalty,
            source=f"hint_{hint.id}",
        )
        db.add(penalty)

    # Audit log
    db.add(AuditEvent(
        team_id=team.id,
        event_type="hint_requested",
        payload=f'{{"hint_id": "{hint.id}", "penalty": {hint.penalty}}}',
    ))

    db.commit()

    return {
        "success": True,
        "already_unlocked": False,
        "penalty_applied": hint.penalty,
        "hint": {
            "id": hint.id,
            "title": hint.title,
            "body": hint.body,
            "penalty": hint.penalty,
        },
    }
