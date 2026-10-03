import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_admin
from ..db import get_db
from ..models import (
    AuditEvent,
    ConfigKV,
    HintCatalog,
    HintUse,
    MarketPurchase,
    Penalty,
    PoliceClock,
    StageProgress,
    Submission,
    Team,
    TeamCompromise,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
def get_admin_dashboard(
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    teams = db.query(Team).order_by(Team.id).all()
    all_progress = db.query(StageProgress).all()
    all_penalties = db.query(Penalty).all()
    all_hints_used = db.query(HintUse).all()
    all_purchases = db.query(MarketPurchase).all()
    all_submissions = db.query(Submission).order_by(Submission.id.desc()).limit(50).all()

    progress_map = {}
    for p in all_progress:
        progress_map.setdefault(p.team_id, {})[p.stage] = {
            "status": p.status,
            "score": p.score,
        }

    penalty_map = {}
    for pen in all_penalties:
        penalty_map.setdefault(pen.team_id, []).append({
            "id": pen.id,
            "reason": pen.reason,
            "amount": pen.amount,
            "created_at": pen.created_at.isoformat(),
        })

    hints_map = {}
    for h in all_hints_used:
        hints_map.setdefault(h.team_id, []).append({
            "hint_id": h.hint_id,
            "penalty": h.penalty,
            "created_at": h.created_at.isoformat(),
        })

    purchases_map = {}
    for pur in all_purchases:
        purchases_map.setdefault(pur.team_id, []).append({
            "item_id": pur.item_id,
            "price": pur.price,
            "category": pur.category,
            "created_at": pur.created_at.isoformat(),
        })

    team_data = []
    for t in teams:
        team_prog = progress_map.get(t.id, {})
        team_pen = penalty_map.get(t.id, [])
        team_hints = hints_map.get(t.id, [])
        team_pur = purchases_map.get(t.id, [])

        total_stage_score = sum(p["score"] for p in team_prog.values())
        total_penalties = sum(p["amount"] for p in team_pen)

        completed_stages = [s for s, p in team_prog.items() if p["status"] == "completed"]
        skipped_stages = [s for s, p in team_prog.items() if p["status"] == "skipped"]

        team_data.append({
            "id": t.id,
            "code": t.code,
            "name": t.name,
            "current_stage": t.current_stage,
            "completed_stages": completed_stages,
            "skipped_stages": skipped_stages,
            "stage_scores": {s: p["score"] for s, p in team_prog.items()},
            "total_score": round(max(0.0, total_stage_score - total_penalties), 2),
            "money": t.money,
            "risk": t.risk,
            "final_score": t.final_score,
            "hints_used": len(team_hints),
            "penalties_count": len(team_pen),
            "total_penalties_amount": total_penalties,
            "black_market_purchases": t.black_market_purchases,
            "penalties": team_pen,
            "purchases": team_pur,
        })

    clock = db.query(PoliceClock).filter(PoliceClock.id == 1).one_or_none()
    compromised_nodes = json.loads(clock.compromised_json or "[]") if clock else []

    return {
        "success": True,
        "team_count": len(teams),
        "police_clock_t": clock.t if clock else 10.0,
        "compromised_nodes": compromised_nodes,
        "teams": team_data,
        "recent_submissions": [
            {
                "id": s.id,
                "team_id": s.team_id,
                "stage": s.stage,
                "accepted": s.accepted,
                "score": s.score,
                "reason": s.reason,
                "created_at": s.created_at.isoformat(),
            }
            for s in all_submissions
        ],
    }


# Hint Catalog Management
@router.get("/hints")
def list_hint_catalog(
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    hints = db.query(HintCatalog).order_by(HintCatalog.stage, HintCatalog.sort_order).all()
    return {
        "success": True,
        "hints": [
            {
                "id": h.id,
                "stage": h.stage,
                "title": h.title,
                "body": h.body,
                "penalty": h.penalty,
                "enabled": h.enabled,
                "sort_order": h.sort_order,
            }
            for h in hints
        ],
    }


class ToggleHintRequest(BaseModel):
    hint_id: str
    enabled: bool


@router.post("/hints/toggle")
def toggle_hint(
    req: ToggleHintRequest,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    hint = db.query(HintCatalog).filter(HintCatalog.id == req.hint_id).one_or_none()
    if not hint:
        raise HTTPException(status_code=404, detail="Hint not found")

    hint.enabled = req.enabled
    db.add(AuditEvent(
        team_id=None,
        event_type="admin_hint_toggled",
        payload=f'{{"hint_id": "{hint.id}", "enabled": {req.enabled}}}',
    ))
    db.commit()

    return {"success": True, "message": f"Hint '{hint.title}' {'enabled' if req.enabled else 'disabled'}."}


class ApplyPenaltyRequest(BaseModel):
    team_id: int
    amount: float
    reason: str


@router.post("/penalties/apply")
def apply_penalty(
    req: ApplyPenaltyRequest,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == req.team_id).one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    penalty = Penalty(
        team_id=team.id,
        reason=req.reason,
        amount=req.amount,
        source="organizer_override",
    )
    db.add(penalty)
    db.add(AuditEvent(
        team_id=team.id,
        event_type="admin_penalty_applied",
        payload=f'{{"amount": {req.amount}, "reason": "{req.reason}"}}',
    ))
    db.commit()

    return {"success": True, "message": f"Penalty of {req.amount} pts applied to {team.name}."}


class CompromiseNodeRequest(BaseModel):
    node_id: str
    team_id: Optional[int] = None
    action: str = "add"  # "add" or "remove"


@router.post("/police/compromise")
def manage_police_compromise(
    req: CompromiseNodeRequest,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    node = req.node_id.strip().upper()
    if req.team_id:
        # Team specific compromise
        existing = db.query(TeamCompromise).filter(
            TeamCompromise.team_id == req.team_id,
            TeamCompromise.node_id == node,
        ).one_or_none()
        if req.action == "add" and not existing:
            db.add(TeamCompromise(team_id=req.team_id, node_id=node))
        elif req.action == "remove" and existing:
            db.delete(existing)
    else:
        # Global compromise
        clock = db.query(PoliceClock).filter(PoliceClock.id == 1).one_or_none()
        if clock:
            nodes = set(json.loads(clock.compromised_json or "[]"))
            if req.action == "add":
                nodes.add(node)
            elif req.action == "remove":
                nodes.discard(node)
            clock.compromised_json = json.dumps(sorted(list(nodes)))

    db.add(AuditEvent(
        team_id=req.team_id,
        event_type="admin_node_compromised",
        payload=f'{{"node": "{node}", "action": "{req.action}"}}',
    ))
    db.commit()

    return {"success": True, "message": f"Node {node} updated ({req.action})."}


@router.get("/audit-events")
def get_audit_log(
    limit: int = 50,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    events = db.query(AuditEvent).order_by(AuditEvent.id.desc()).limit(limit).all()
    return {
        "success": True,
        "events": [
            {
                "id": e.id,
                "team_id": e.team_id,
                "event_type": e.event_type,
                "payload": json.loads(e.payload or "{}") if e.payload.startswith("{") else e.payload,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }
