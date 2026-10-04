import json
import time
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team, require_stage
from ..db import get_db
from ..games.police.route_code import compute_route_code
from ..games.police.solver import load_graph, path_totals, validate_path
from ..models import AuditEvent, ConfigKV, GameOutput, PoliceClock, StageProgress, Submission, Team, TeamCompromise
from ..security import record_submission_attempt

router = APIRouter(
    prefix="/api/police",
    tags=["police"],
    dependencies=[Depends(require_stage(3))],
)

_graph_cache = None


def _cfg(db: Session, key: str) -> str:
    row = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if not row:
        raise HTTPException(status_code=503, detail=f"Game configuration is missing: {key}")
    return row.value


def get_cached_graph():
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = load_graph()
    return _graph_cache


def get_or_create_police_clock(db: Session) -> PoliceClock:
    clock = db.query(PoliceClock).filter(PoliceClock.id == 1).one_or_none()
    if not clock:
        clock = PoliceClock(id=1, t=float(_cfg(db, "police_initial_time")), running=True, compromised_json="[]")
        db.add(clock)
        db.commit()
        db.refresh(clock)
    return clock


@router.get("/graph")
def get_graph():
    return get_cached_graph()


@router.get("/state")
def get_police_state(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    clock = get_or_create_police_clock(db)
    global_compromised = set(json.loads(clock.compromised_json or "[]"))

    # Team-specific compromises
    team_comps = db.query(TeamCompromise).filter(TeamCompromise.team_id == team.id).all()
    team_compromised = {c.node_id for c in team_comps}
    all_compromised = sorted(list(global_compromised | team_compromised))

    # Team's best accepted submission
    best_sub = (
        db.query(Submission)
        .filter(Submission.team_id == team.id, Submission.stage == "police", Submission.accepted == True)
        .order_by(Submission.score.desc())
        .first()
    )

    budget = float(_cfg(db, "police_budget"))
    deadline = float(_cfg(db, "police_deadline"))

    return {
        "success": True,
        "t": clock.t,
        "running": clock.running,
        "compromised": all_compromised,
        "team_code": team.code,
        "budget": budget,
        "deadline": deadline,
        "has_valid_route": best_sub is not None,
        # Only return route metadata (score/risk), NOT the raw route nodes
        "best_score": best_sub.score if best_sub else None,
    }


class RouteSubmissionRequest(BaseModel):
    route: List[str]


@router.post("/submit")
def submit_escape_route(
    req: RouteSubmissionRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    record_submission_attempt(db, team.id, "police_route_submission_attempt")

    graph = get_cached_graph()
    clock = get_or_create_police_clock(db)
    global_comp = set(json.loads(clock.compromised_json or "[]"))
    team_comps = {c.node_id for c in db.query(TeamCompromise).filter(TeamCompromise.team_id == team.id).all()}
    compromised = global_comp | team_comps

    budget = float(_cfg(db, "police_budget"))
    deadline = float(_cfg(db, "police_deadline"))
    min_score = float(_cfg(db, "police_min_score"))
    max_score = float(_cfg(db, "police_max_score"))
    risk_factor = float(_cfg(db, "police_risk_score_factor"))

    ok, reason, edges = validate_path(
        graph,
        req.route,
        t=clock.t,
        compromised=compromised,
        deadline=deadline,
        budget=budget,
    )

    if not ok:
        sub = Submission(
            team_id=team.id,
            stage="police",
            accepted=False,
            reason=reason,
            payload=json.dumps({"route_len": len(req.route)}),
            event_t=clock.t,
        )
        db.add(sub)
        db.add(AuditEvent(
            team_id=team.id,
            event_type="police_route_rejected",
            payload=json.dumps({"reason": reason}),
        ))
        db.commit()
        return {"success": False, "message": f"Route Rejected: {reason}"}

    totals = path_totals(edges)
    risk = round(totals["risk"], 2)
    time_cost = round(totals["time"], 2)
    cost = round(totals["cost"], 2)

    # Compute authoritative route code checksum
    route_code = compute_route_code(team.code, req.route, risk)

    # Score calculation from ConfigKV params
    score_awarded = round(max(min_score, max_score - (risk * risk_factor)), 2)

    # Record submission (store route length, not route itself, for privacy)
    sub = Submission(
        team_id=team.id,
        stage="police",
        accepted=True,
        reason="Route Verified!",
        payload=json.dumps({
            "route_len": len(req.route),
            "risk": risk,
            "time": time_cost,
            "cost": cost,
        }),
        score=score_awarded,
        event_t=clock.t,
        route_code=route_code,
    )
    db.add(sub)

    # Update team risk (only if this improves / this is the first accepted route)
    existing_progress = db.query(StageProgress).filter(
        StageProgress.team_id == team.id,
        StageProgress.stage == 3,
    ).one_or_none()

    if not existing_progress:
        # First valid submission
        team.risk = risk
        progress = StageProgress(team_id=team.id, stage=3, status="completed", score=score_awarded)
        db.add(progress)
        if team.current_stage == 3:
            team.current_stage = 4
        db.add(AuditEvent(
            team_id=team.id,
            event_type="stage_3_completed",
            payload=json.dumps({"route_code": route_code, "risk": risk, "score": score_awarded}),
        ))
    else:
        # Resubmission: only update if better score (lower risk)
        if score_awarded > existing_progress.score:
            team.risk = risk
            existing_progress.score = score_awarded
            existing_progress.updated_at = datetime.utcnow()
            db.add(AuditEvent(
                team_id=team.id,
                event_type="police_route_improved",
                payload=json.dumps({"route_code": route_code, "risk": risk, "score": score_awarded}),
            ))

    # Store authoritative route code output for Stage 4
    output = db.query(GameOutput).filter(
        GameOutput.team_id == team.id,
        GameOutput.key == "route_code",
    ).one_or_none()
    if not output:
        db.add(GameOutput(team_id=team.id, key="route_code", value=route_code))
    else:
        # Only update if this route earned a better score
        if not existing_progress or score_awarded >= (existing_progress.score if existing_progress else 0):
            output.value = route_code

    db.commit()

    return {
        "success": True,
        "message": "Escape route verified! Evacuation vector locked in.",
        "risk": risk,
        "time": time_cost,
        "cost": cost,
        "score_awarded": score_awarded,
        "next_stage": team.current_stage,
    }
