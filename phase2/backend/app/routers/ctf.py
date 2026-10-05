import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team, require_stage
from ..db import get_db
from ..games.control.engine import (
    evaluate_code_submission,
    evaluate_teller_login,
)
from ..models import AuditEvent, ConfigKV, CtfState, GameOutput, StageProgress, Submission, Team
from ..security import record_submission_attempt

router = APIRouter(
    prefix="/api/ctf",
    tags=["ctf"],
    dependencies=[Depends(require_stage(2))],
)

def _cfg(db: Session, key: str) -> str:
    row = db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none()
    if not row:
        raise HTTPException(status_code=503, detail=f"Game configuration is missing: {key}")
    return row.value


def _get_puzzle_codes(db: Session) -> dict:
    return {3: _cfg(db, "ctf_puzzle3_code")}


def get_or_create_ctf_state(team_id: int, db: Session) -> CtfState:
    state = db.query(CtfState).filter(CtfState.team_id == team_id).one_or_none()
    if not state:
        state = CtfState(
            team_id=team_id,
            lives=3,
            score=0,
            start_time=datetime.utcnow(),
            balance_request_count=0,
            puzzles_json=json.dumps({
                "1": {"solved": False, "opened": True},
                "2": {"solved": False, "opened": False},
                "3": {"solved": False, "opened": False},
            }),
        )
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def mark_puzzle_solved(team: Team, state: CtfState, puzzles: dict, puzzle_id: int, db: Session) -> bool:
    puzzle_key = str(puzzle_id)
    if puzzles.get(puzzle_key, {}).get("solved"):
        return all(puzzles.get(str(i), {}).get("solved") for i in (1, 2, 3))

    points = int(_cfg(db, f"ctf_puzzle{puzzle_id}_points"))
    puzzles[puzzle_key] = {"solved": True, "opened": True}
    state.puzzles_json = json.dumps(puzzles)
    state.score += points
    all_solved = all(puzzles.get(str(i), {}).get("solved") for i in (1, 2, 3))

    if all_solved:
        control_token = _cfg(db, "ctf_control_token")
        if not control_token:
            raise HTTPException(status_code=503, detail="Control token is not configured")
        stage2_score = float(_cfg(db, "stage2_max_score"))
        progress = db.query(StageProgress).filter(
            StageProgress.team_id == team.id,
            StageProgress.stage == 2,
        ).one_or_none()
        if not progress:
            db.add(StageProgress(team_id=team.id, stage=2, status="completed", score=stage2_score))
        elif progress.status != "completed":
            progress.status = "completed"
            progress.score = stage2_score
            progress.updated_at = datetime.utcnow()

        output = db.query(GameOutput).filter(
            GameOutput.team_id == team.id,
            GameOutput.key == "control_token",
        ).one_or_none()
        if not output:
            db.add(GameOutput(team_id=team.id, key="control_token", value=control_token))

        if team.current_stage == 2:
            team.current_stage = 3
        db.add(AuditEvent(
            team_id=team.id,
            event_type="stage_2_completed",
            payload=json.dumps({"score": stage2_score}),
        ))

    return all_solved


@router.get("/state")
def get_ctf_state(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    state = get_or_create_ctf_state(team.id, db)
    puzzles = json.loads(state.puzzles_json)
    solved_count = sum(1 for p in puzzles.values() if p.get("solved"))

    p1_pts = int(_cfg(db, "ctf_puzzle1_points"))
    p2_pts = int(_cfg(db, "ctf_puzzle2_points"))
    p3_pts = int(_cfg(db, "ctf_puzzle3_points"))

    return {
        "success": True,
        "state": {
            "lives": state.lives,
            "maxLives": 3,
            "score": state.score,
            "solvedCount": solved_count,
            "totalPuzzles": 3,
            "isCompleted": solved_count == 3,
            "puzzles": {
                "1": {
                    "id": 1,
                    "title": "The Teller Login",
                    "category": "SQL Injection",
                    "story": "A teller forgot their password. The portal is old — when login fails, it displays the query structure. The security filter strips -- and ; comments.",
                    "solved": puzzles.get("1", {}).get("solved", False),
                    "points": p1_pts,
                    "bankPageUrl": "/bank/teller-login",
                },
                "2": {
                    "id": 2,
                    "title": "The Frozen Transfer Button",
                    "category": "DOM Manipulation",
                    "story": "The Transfer button is disabled and a transparent overlay blocks the form.",
                    "solved": puzzles.get("2", {}).get("solved", False),
                    "points": p2_pts,
                    "bankPageUrl": "/bank/transfers",
                },
                "3": {
                    "id": 3,
                    "title": "The Hidden Audit Header",
                    "category": "HTTP Response Inspection",
                    "story": "Your dashboard loads your balance fine. But the bank's internal audit code travels in HTTP response headers, not inside the page body.",
                    "solved": puzzles.get("3", {}).get("solved", False),
                    "points": p3_pts,
                    "bankPageUrl": "/bank/dashboard",
                },
            },
        },
    }


class TellerLoginRequest(BaseModel):
    username: str = ""
    password: str = ""


@router.post("/puzzle1/login")
def ctf_teller_login(
    req: TellerLoginRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    record_submission_attempt(db, team.id, "ctf_teller_login_attempt")
    success, query, _placeholder, was_filtered, message = evaluate_teller_login(req.username, req.password)

    all_solved = False
    if success:
        state = get_or_create_ctf_state(team.id, db)
        puzzles = json.loads(state.puzzles_json)
        all_solved = mark_puzzle_solved(team, state, puzzles, 1, db)

    db.add(AuditEvent(
        team_id=team.id,
        event_type="ctf_puzzle1_attempt",
        payload=json.dumps({"success": success, "filtered": was_filtered}),
    ))
    db.commit()

    return {
        "success": success,
        "query": query,
        "filtered": was_filtered,
        "filterNotice": "Suspicious characters stripped for your security." if was_filtered else None,
        "puzzleSolved": success,
        "allSolved": all_solved,
        "message": message,
    }


@router.post("/puzzle1/emergency-access")
def ctf_emergency_access_trap(team: Team = Depends(current_team), db: Session = Depends(get_db)):
    db.add(AuditEvent(
        team_id=team.id,
        event_type="ctf_honeypot_triggered",
        payload='{"trap": "emergency_access"}',
    ))
    db.commit()
    return {
        "success": False,
        "trapTriggered": True,
        "lifeLost": False,
        "message": "SECURITY WARNING: Emergency bypass terminal is a monitored honeypot! (No penalty incurred)",
    }


class TransferRequest(BaseModel):
    fromAccount: str = "1001"
    toAccount: str = "IVB-OFFSHORE-1"
    amount: str = "1000"


@router.post("/puzzle2/transfer")
def ctf_transfer(
    req: TransferRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    record_submission_attempt(db, team.id, "ctf_transfer_submission_attempt")
    state = get_or_create_ctf_state(team.id, db)
    puzzles = json.loads(state.puzzles_json)
    all_solved = mark_puzzle_solved(team, state, puzzles, 2, db)
    db.add(AuditEvent(
        team_id=team.id,
        event_type="ctf_puzzle2_transfer",
        payload=json.dumps({"amount": str(req.amount)[:32], "all_solved": all_solved}),
    ))
    db.commit()
    return {
        "success": True,
        "puzzleSolved": True,
        "allSolved": all_solved,
        "message": f"Wire transfer of ${req.amount} cleared.",
    }


@router.post("/puzzle2/trap-unlock")
def ctf_trap_unlock(team: Team = Depends(current_team), db: Session = Depends(get_db)):
    db.add(AuditEvent(
        team_id=team.id,
        event_type="ctf_honeypot_triggered",
        payload='{"trap": "quick_unlock"}',
    ))
    db.commit()
    return {
        "success": False,
        "trapTriggered": True,
        "lifeLost": False,
        "message": "SECURITY WARNING: Automated quick-unlock detected as tampering. (No penalty incurred)",
    }


@router.get("/balance")
def ctf_balance(
    acct: str = Query("1001"),
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
    response: Response = None,
):
    state = get_or_create_ctf_state(team.id, db)
    state.balance_request_count += 1
    db.commit()

    req_id = str(uuid.uuid4())
    decoy_code = _cfg(db, "ctf_decoy_body_code")
    response.headers["X-Request-Id"] = req_id
    response.headers["Access-Control-Expose-Headers"] = "X-Audit-Code, X-Request-Id"
    response.headers["Cache-Control"] = "no-store, private, max-age=0"

    # Header appears on 2nd or subsequent requests (hard mode cache miss)
    if state.balance_request_count >= 2:
        puzzle3_code = _cfg(db, "ctf_puzzle3_code")
        response.headers["X-Audit-Code"] = puzzle3_code

    return {
        "acct": acct,
        "balance": "$4,213.50",
        "audit_code": decoy_code,
    }


class SubmitCodeRequest(BaseModel):
    puzzleId: int
    code: str


@router.post("/submit-code")
def ctf_submit_code(
    req: SubmitCodeRequest,
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    # Idempotency: check if puzzle already solved
    state = get_or_create_ctf_state(team.id, db)
    puzzles = json.loads(state.puzzles_json)

    if puzzles.get(str(req.puzzleId), {}).get("solved"):
        return {"success": True, "message": "Already solved.", "alreadySolved": True, "allSolved": all(
            puzzles.get(str(i), {}).get("solved") for i in [1, 2, 3]
        )}

    if req.puzzleId in (1, 2):
        return {"success": False, "trapTriggered": False, "message": "Complete this sector through its challenge interaction."}

    record_submission_attempt(db, team.id, "ctf_code_submission_attempt")

    # Rate limit: check recent wrong submissions
    puzzle_codes = _get_puzzle_codes(db)
    decoy_code = _cfg(db, "ctf_decoy_body_code")

    success, message, trap = evaluate_code_submission(req.puzzleId, req.code, puzzle_codes, decoy_code)

    if not success:
        db.add(AuditEvent(
            team_id=team.id,
            event_type="ctf_wrong_code",
            payload=json.dumps({"puzzle_id": req.puzzleId, "trap": trap}),
        ))
        db.commit()
        return {
            "success": False,
            "trapTriggered": trap,
            "message": message,
        }

    all_solved = mark_puzzle_solved(team, state, puzzles, req.puzzleId, db)

    db.commit()

    return {
        "success": True,
        "message": message,
        "allSolved": all_solved,
        # Never return the control_token in the response — it's stored server-side
        "next_stage": team.current_stage if all_solved else None,
    }
