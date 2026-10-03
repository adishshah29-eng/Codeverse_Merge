import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import current_team
from ..db import get_db
from ..games.control.engine import (
    CONTROL_SERVER_TOKEN,
    PUZZLE_CODES,
    evaluate_code_submission,
    evaluate_teller_login,
)
from ..models import AuditEvent, CtfState, GameOutput, StageProgress, Submission, Team

router = APIRouter(prefix="/api/ctf", tags=["ctf"])


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


@router.get("/state")
def get_ctf_state(
    team: Team = Depends(current_team),
    db: Session = Depends(get_db),
):
    state = get_or_create_ctf_state(team.id, db)
    puzzles = json.loads(state.puzzles_json)
    solved_count = sum(1 for p in puzzles.values() if p.get("solved"))

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
                    "points": 3,
                    "bankPageUrl": "/bank/teller-login",
                },
                "2": {
                    "id": 2,
                    "title": "The Frozen Transfer Button",
                    "category": "DOM Manipulation",
                    "story": "The Transfer button is disabled and a transparent overlay blocks the form.",
                    "solved": puzzles.get("2", {}).get("solved", False),
                    "points": 3,
                    "bankPageUrl": "/bank/transfers",
                },
                "3": {
                    "id": 3,
                    "title": "The Hidden Audit Header",
                    "category": "HTTP Response Inspection",
                    "story": "Your dashboard loads your balance fine. But the bank's internal audit code travels in HTTP response headers, not inside the page body.",
                    "solved": puzzles.get("3", {}).get("solved", False),
                    "points": 4,
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
):
    success, query, code, was_filtered, message = evaluate_teller_login(req.username, req.password)
    return {
        "success": success,
        "query": query,
        "filtered": was_filtered,
        "filterNotice": "Suspicious characters stripped for your security." if was_filtered else None,
        "authCode": code if success else None,
        "message": message,
    }


@router.post("/puzzle1/emergency-access")
def ctf_emergency_access_trap(team: Team = Depends(current_team)):
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
):
    return {
        "success": True,
        "authCode": PUZZLE_CODES[2],
        "message": f"Wire transfer of ${req.amount} cleared! Authorization Code: {PUZZLE_CODES[2]}",
    }


@router.post("/puzzle2/trap-unlock")
def ctf_trap_unlock(team: Team = Depends(current_team)):
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
    response.headers["X-Request-Id"] = req_id
    response.headers["Access-Control-Expose-Headers"] = "X-Audit-Code, X-Request-Id"
    response.headers["Cache-Control"] = "no-store, private, max-age=0"

    # Header appears on 2nd or subsequent requests (hard mode cache miss)
    if state.balance_request_count >= 2:
        response.headers["X-Audit-Code"] = PUZZLE_CODES[3]

    return {
        "acct": acct,
        "balance": "$4,213.50",
        "audit_code": "FAKE-000-DECOY",
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
    success, message, trap = evaluate_code_submission(req.puzzleId, req.code)
    state = get_or_create_ctf_state(team.id, db)
    puzzles = json.loads(state.puzzles_json)

    if not success:
        return {
            "success": False,
            "trapTriggered": trap,
            "message": message,
        }

    # Mark puzzle solved
    puzzles[str(req.puzzleId)] = {"solved": True, "opened": True}
    state.puzzles_json = json.dumps(puzzles)
    state.score += 3 if req.puzzleId != 3 else 4
    all_solved = all(puzzles.get(str(i), {}).get("solved") for i in [1, 2, 3])

    if all_solved:
        # Award max 10.0 points for Stage 2
        progress = db.query(StageProgress).filter(
            StageProgress.team_id == team.id,
            StageProgress.stage == 2,
        ).one_or_none()
        if not progress:
            progress = StageProgress(team_id=team.id, stage=2, status="completed", score=10.0)
            db.add(progress)
        else:
            progress.status = "completed"
            progress.score = 10.0
            progress.updated_at = datetime.utcnow()

        # Save authoritative Control Token
        output = db.query(GameOutput).filter(
            GameOutput.team_id == team.id,
            GameOutput.key == "control_token",
        ).one_or_none()
        if not output:
            db.add(GameOutput(team_id=team.id, key="control_token", value=CONTROL_SERVER_TOKEN))
        else:
            output.value = CONTROL_SERVER_TOKEN

        if team.current_stage == 2:
            team.current_stage = 3

        db.add(AuditEvent(
            team_id=team.id,
            event_type="stage_2_completed",
            payload=f'{{"control_token": "{CONTROL_SERVER_TOKEN}", "score": 10.0}}',
        ))

    db.commit()

    return {
        "success": True,
        "message": message,
        "allSolved": all_solved,
        "control_token": CONTROL_SERVER_TOKEN if all_solved else None,
        "next_stage": team.current_stage if all_solved else None,
    }
