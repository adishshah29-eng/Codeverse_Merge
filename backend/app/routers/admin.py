import json
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import current_admin
from ..db import get_db
from ..models import (
    AuditEvent,
    CtfState,
    ConfigKV,
    GameOutput,
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
from ..passwords import hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _is_sensitive_config_key(key: str) -> bool:
    return any(part in key.lower() for part in ("key", "code", "token", "sequence", "secret"))


def _parse_audit_payload(payload: str | None):
    if not payload:
        return {}
    if not payload.startswith("{"):
        return payload
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return payload


class CreateTeamRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


@router.post("/teams")
def create_team(
    req: CreateTeamRequest,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    code = req.code.strip().upper()
    name = req.name.strip()
    email = req.email.strip().lower()
    if not code or not name or "@" not in email or any(char.isspace() for char in email):
        raise HTTPException(status_code=422, detail="Enter a team code, name, and valid email")
    # Hash before touching the database so the write lock is held only briefly.
    password_hash = hash_password(req.password)

    if db.query(Team).filter(Team.code.ilike(code)).one_or_none():
        raise HTTPException(status_code=409, detail="A team with this code already exists")
    if db.query(Team).filter(Team.email == email).one_or_none():
        raise HTTPException(status_code=409, detail="A team with this email already exists")

    team = Team(code=code, name=name, email=email, password_hash=password_hash)
    db.add(team)
    db.flush()
    db.add(AuditEvent(
        team_id=team.id,
        event_type="admin_team_created",
        payload=json.dumps({"code": code, "name": name, "email": email}),
    ))
    db.commit()

    return {"success": True, "message": f"Team {code} created.", "team": {"id": team.id, "code": code, "name": name, "email": email}}


@router.delete("/teams/{team_id}")
def delete_team(
    team_id: int,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    team_details = {"code": team.code, "name": team.name}
    db.query(AuditEvent).filter(AuditEvent.team_id == team.id).update(
        {AuditEvent.team_id: None}, synchronize_session=False
    )
    for model in (GameOutput, StageProgress, Submission, HintUse, Penalty, MarketPurchase, CtfState, TeamCompromise):
        db.query(model).filter(model.team_id == team.id).delete(synchronize_session=False)
    db.delete(team)
    db.add(AuditEvent(
        team_id=None,
        event_type="admin_team_deleted",
        payload=json.dumps(team_details),
    ))

    db.commit()

    return {"success": True, "message": f"Team {team_details['code']} deleted."}


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
            "has_login": bool(t.password_hash),
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
        "police_clock_t": clock.t if clock else None,
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
        payload=json.dumps({"hint_id": hint.id, "enabled": req.enabled}),
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
        payload=json.dumps({"amount": req.amount, "reason": req.reason}),
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
        payload=json.dumps({"node": node, "action": req.action}),
    ))
    db.commit()

    return {"success": True, "message": f"Node {node} updated ({req.action})."}


@router.get("/config")
def list_config(
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    """List all game configuration values. Admins can view and update these."""
    rows = db.query(ConfigKV).order_by(ConfigKV.key).all()
    return {
        "success": True,
        "config": [
            {"key": r.key, "value": "********" if _is_sensitive_config_key(r.key) else r.value}
            for r in rows
        ],
    }


class SetConfigRequest(BaseModel):
    value: str


@router.put("/config/{key}")
def set_config(
    key: str,
    req: SetConfigRequest,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    """Set or update a game configuration value."""
    row = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if row:
        row.value = req.value
    else:
        db.add(ConfigKV(key=key, value=req.value))

    db.add(AuditEvent(
        team_id=None,
        event_type="admin_config_changed",
        payload=json.dumps({"key": key, "by": admin.get("sub"), "secret": _is_sensitive_config_key(key)}),
    ))
    db.commit()
    return {"success": True, "key": key, "value": "********" if _is_sensitive_config_key(key) else req.value}


class AdjustTeamRequest(BaseModel):
    money: int | None = None
    risk: float | None = None
    current_stage: int | None = None
    reason: str = "Admin override"


@router.post("/teams/{team_id}/adjust")
def adjust_team(
    team_id: int,
    req: AdjustTeamRequest,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    """Admin override for team money, risk, or stage — always audited."""
    team = db.query(Team).filter(Team.id == team_id).one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    changes = {}
    if req.money is not None:
        changes["money"] = {"old": team.money, "new": req.money}
        team.money = req.money
    if req.risk is not None:
        changes["risk"] = {"old": team.risk, "new": req.risk}
        team.risk = req.risk
    if req.current_stage is not None:
        if req.current_stage < 1 or req.current_stage > 4:
            raise HTTPException(status_code=400, detail="Stage must be 1-4")
        changes["current_stage"] = {"old": team.current_stage, "new": req.current_stage}
        team.current_stage = req.current_stage

    db.add(AuditEvent(
        team_id=team_id,
        event_type="admin_team_adjusted",
        payload=json.dumps({"changes": changes, "reason": req.reason, "by": admin.get("sub")}),
    ))
    db.commit()
    return {"success": True, "message": f"Team {team.code} adjusted.", "changes": changes}


@router.get("/audit-events")
def get_audit_log(
    limit: int = 100,
    team_id: int | None = None,
    event_type: str | None = None,
    admin: dict = Depends(current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(AuditEvent).order_by(AuditEvent.id.desc())
    if team_id is not None:
        query = query.filter(AuditEvent.team_id == team_id)
    if event_type:
        query = query.filter(AuditEvent.event_type == event_type)
    events = query.limit(min(limit, 500)).all()
    return {
        "success": True,
        "events": [
            {
                "id": e.id,
                "team_id": e.team_id,
                "event_type": e.event_type,
                "payload": _parse_audit_payload(e.payload),
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ],
    }
