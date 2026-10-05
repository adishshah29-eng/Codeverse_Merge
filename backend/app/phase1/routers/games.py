import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.phase1.core.database import decode_json
from app.phase1.core.engine import ProgressionEngine
from app.phase1.deps import phase1_team_id
from app.phase1.core.models import (
    Game1Submission, Game2Submission, Game3Submission, Game4Submission, Game5Submission,
    GenericSubmissionResponse, MAX_CODE_CHARS
)
from app.phase1.core.scoring import (
    calculate_game1_score, calculate_game2_score, calculate_game3_score,
    calculate_game4_score, calculate_game5_score
)
from app.phase1.games.g1_vault_breach import load_public_challenge, verify_vault_solution
from app.phase1.games.g2_alarm_system import get_challenges_list, execute_python_code, verify_alarm_solution
from app.phase1.games.g3_hidden_blueprint import (
    get_archive_ping, get_archive_manifest, get_archive_press,
    verify_blueprint_query, verify_blueprint_submission
)
from app.phase1.games.g4_mint_map import get_map_dataset, evaluate_mint_route
from app.phase1.games.g5_printing_press import get_dataset_info, evaluate_ml_model

router = APIRouter(prefix="/games", tags=["Games"])

# ── GAME 1: VAULT BREACH ───────────────────────────────────────────────────────

@router.get("/1/challenge")
def get_game1_challenge(team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 1)
    return load_public_challenge()

@router.post("/1/submit", response_model=GenericSubmissionResponse)
def submit_game1(payload: Game1Submission, team_id: str = Depends(phase1_team_id)):
    progress = ProgressionEngine.verify_stage_access(team_id, 1)
    
    # Idempotency check
    existing = ProgressionEngine.check_idempotency(team_id, 1, payload.idempotency_key)
    if existing:
        return GenericSubmissionResponse(
            success=True,
            stage_id=1,
            passed=bool(existing["passed"]),
            score_awarded=existing["score_awarded"],
            total_stage_score=progress["score"],
            message="Idempotent: Returning previously recorded submission result."
        )

    # Calculate elapsed seconds from started_at
    elapsed = 120
    if progress["started_at"]:
        try:
            s_dt = datetime.fromisoformat(progress["started_at"])
            elapsed = int((datetime.now(timezone.utc) - s_dt).total_seconds())
        except Exception:
            pass

    verif = verify_vault_solution(
        payload.final_code,
        payload.extracted_door,
        payload.extracted_witness,
        payload.extracted_metal,
        payload.shift
    )

    hints_used = decode_json(progress["hints_used"], [])
    wrong_attempts = progress["wrong_attempts"]
    
    score_res = calculate_game1_score(
        elapsed_seconds=elapsed,
        wrong_attempts=wrong_attempts + (0 if verif["passed"] else 1),
        hints_used=hints_used,
        extracted_correct=verif["passed"]
    )
    
    score_awarded = score_res["score"]
    
    ProgressionEngine.record_submission_attempt(
        team_id=team_id,
        stage_id=1,
        idempotency_key=payload.idempotency_key,
        payload=payload.dict(),
        passed=verif["passed"],
        score_awarded=score_awarded,
        feedback=verif["message"]
    )
    
    if verif["passed"]:
        ProgressionEngine.complete_stage(
            team_id=team_id,
            stage_id=1,
            final_score=score_awarded,
            metadata={"elapsed_seconds": elapsed, "breakdown": score_res["breakdown"]}
        )
        return GenericSubmissionResponse(
            success=True,
            stage_id=1,
            passed=True,
            score_awarded=score_awarded,
            total_stage_score=score_awarded,
            message=verif["message"],
            feedback=score_res["breakdown"],
            next_stage=2
        )
    else:
        return GenericSubmissionResponse(
            success=False,
            stage_id=1,
            passed=False,
            score_awarded=0.0,
            total_stage_score=progress["score"],
            message=verif["message"],
            feedback=verif["details"]
        )

# ── GAME 2: ALARM SYSTEM ───────────────────────────────────────────────────────

@router.get("/2/challenges")
def get_game2_challenges(team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 2)
    return {"challenges": get_challenges_list()}

class CodeRunRequest(BaseModel):
    code: str = Field(..., max_length=MAX_CODE_CHARS)

@router.post("/2/run")
def run_game2_code(payload: CodeRunRequest, team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 2)
    return execute_python_code(payload.code)

@router.post("/2/submit", response_model=GenericSubmissionResponse)
def submit_game2(payload: Game2Submission, team_id: str = Depends(phase1_team_id)):
    progress = ProgressionEngine.verify_stage_access(team_id, 2)
    
    existing = ProgressionEngine.check_idempotency(team_id, 2, payload.idempotency_key)
    if existing:
        return GenericSubmissionResponse(
            success=True,
            stage_id=2,
            passed=bool(existing["passed"]),
            score_awarded=existing["score_awarded"],
            total_stage_score=progress["score"],
            message="Idempotent: Returning previously recorded submission result."
        )

    elapsed = 120
    if progress["started_at"]:
        try:
            s_dt = datetime.fromisoformat(progress["started_at"])
            elapsed = int((datetime.now(timezone.utc) - s_dt).total_seconds())
        except Exception:
            pass

    verif = verify_alarm_solution(payload.challenge_id, payload.code)
    hints_used = decode_json(progress["hints_used"], [])
    wrong_attempts = progress["wrong_attempts"]

    score_res = calculate_game2_score(
        elapsed_seconds=elapsed,
        wrong_attempts=wrong_attempts + (0 if verif["passed"] else 1),
        hints_used=hints_used,
        passed=verif["passed"]
    )
    score_awarded = score_res["score"]

    ProgressionEngine.record_submission_attempt(
        team_id=team_id,
        stage_id=2,
        idempotency_key=payload.idempotency_key,
        payload=payload.dict(),
        passed=verif["passed"],
        score_awarded=score_awarded,
        feedback=verif["message"]
    )

    if verif["passed"]:
        ProgressionEngine.complete_stage(
            team_id=team_id,
            stage_id=2,
            final_score=score_awarded,
            metadata={"elapsed_seconds": elapsed, "breakdown": score_res["breakdown"]}
        )
        return GenericSubmissionResponse(
            success=True,
            stage_id=2,
            passed=True,
            score_awarded=score_awarded,
            total_stage_score=score_awarded,
            message=verif["message"],
            feedback={"stdout": verif["stdout"], "breakdown": score_res["breakdown"]},
            next_stage=3
        )
    else:
        return GenericSubmissionResponse(
            success=False,
            stage_id=2,
            passed=False,
            score_awarded=0.0,
            total_stage_score=progress["score"],
            message=verif["message"],
            feedback={"stdout": verif["stdout"], "stderr": verif["stderr"]}
        )

# ── GAME 3: HIDDEN BLUEPRINT ───────────────────────────────────────────────────

@router.get("/3/ping")
def archive_ping():
    return get_archive_ping()

@router.get("/3/manifest")
def archive_manifest():
    return get_archive_manifest()

@router.get("/3/press")
def archive_press():
    return get_archive_press()

@router.get("/3/blueprint")
def query_blueprint(fragment: Optional[str] = Query(None, max_length=64)):
    return verify_blueprint_query(fragment or "")

@router.post("/3/submit", response_model=GenericSubmissionResponse)
def submit_game3(payload: Game3Submission, team_id: str = Depends(phase1_team_id)):
    progress = ProgressionEngine.verify_stage_access(team_id, 3)

    existing = ProgressionEngine.check_idempotency(team_id, 3, payload.idempotency_key)
    if existing:
        return GenericSubmissionResponse(
            success=True,
            stage_id=3,
            passed=bool(existing["passed"]),
            score_awarded=existing["score_awarded"],
            total_stage_score=progress["score"],
            message="Idempotent: Returning previously recorded submission result."
        )

    elapsed = 150
    if progress["started_at"]:
        try:
            s_dt = datetime.fromisoformat(progress["started_at"])
            elapsed = int((datetime.now(timezone.utc) - s_dt).total_seconds())
        except Exception:
            pass

    verif = verify_blueprint_submission(payload.extraction_code, payload.blueprint_fragment)
    hints_used = decode_json(progress["hints_used"], [])
    wrong_attempts = progress["wrong_attempts"]

    score_res = calculate_game3_score(
        elapsed_seconds=elapsed,
        wrong_attempts=wrong_attempts + (0 if verif["passed"] else 1),
        hints_used=hints_used,
        passed=verif["passed"]
    )
    score_awarded = score_res["score"]

    ProgressionEngine.record_submission_attempt(
        team_id=team_id,
        stage_id=3,
        idempotency_key=payload.idempotency_key,
        payload=payload.dict(),
        passed=verif["passed"],
        score_awarded=score_awarded,
        feedback=verif["message"]
    )

    if verif["passed"]:
        ProgressionEngine.complete_stage(
            team_id=team_id,
            stage_id=3,
            final_score=score_awarded,
            metadata={"elapsed_seconds": elapsed, "breakdown": score_res["breakdown"]}
        )
        return GenericSubmissionResponse(
            success=True,
            stage_id=3,
            passed=True,
            score_awarded=score_awarded,
            total_stage_score=score_awarded,
            message=verif["message"],
            feedback=score_res["breakdown"],
            next_stage=4
        )
    else:
        return GenericSubmissionResponse(
            success=False,
            stage_id=3,
            passed=False,
            score_awarded=0.0,
            total_stage_score=progress["score"],
            message=verif["message"],
            feedback=verif["details"]
        )

# ── GAME 4: THE LEAK + MINT MAP ────────────────────────────────────────────────

@router.get("/4/dataset")
def get_game4_dataset(team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 4)
    return get_map_dataset()

class RouteEvaluateRequest(BaseModel):
    route: List[int] = Field(..., max_length=64)

@router.post("/4/evaluate")
def evaluate_game4_route(payload: RouteEvaluateRequest, team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 4)
    return evaluate_mint_route(payload.route)

@router.post("/4/submit", response_model=GenericSubmissionResponse)
def submit_game4(payload: Game4Submission, team_id: str = Depends(phase1_team_id)):
    progress = ProgressionEngine.verify_stage_access(team_id, 4)

    existing = ProgressionEngine.check_idempotency(team_id, 4, payload.idempotency_key)
    if existing:
        return GenericSubmissionResponse(
            success=True,
            stage_id=4,
            passed=bool(existing["passed"]),
            score_awarded=existing["score_awarded"],
            total_stage_score=progress["score"],
            message="Idempotent: Returning previously recorded submission result."
        )

    verif = evaluate_mint_route(payload.route)
    hints_used = decode_json(progress["hints_used"], [])
    wrong_attempts = progress["wrong_attempts"]

    score_res = calculate_game4_score(
        route_cost=verif.get("cost", 300.0),
        wrong_attempts=wrong_attempts + (0 if verif["passed"] else 1),
        hints_used=hints_used,
        passed=verif["passed"]
    )
    score_awarded = score_res["score"]

    ProgressionEngine.record_submission_attempt(
        team_id=team_id,
        stage_id=4,
        idempotency_key=payload.idempotency_key,
        payload=payload.dict(),
        passed=verif["passed"],
        score_awarded=score_awarded,
        feedback=verif["message"]
    )

    if verif["passed"]:
        ProgressionEngine.complete_stage(
            team_id=team_id,
            stage_id=4,
            final_score=score_awarded,
            metadata={"cost": verif.get("cost"), "breakdown": score_res["breakdown"]}
        )
        return GenericSubmissionResponse(
            success=True,
            stage_id=4,
            passed=True,
            score_awarded=score_awarded,
            total_stage_score=score_awarded,
            message=verif["message"],
            feedback=score_res["breakdown"],
            next_stage=5
        )
    else:
        return GenericSubmissionResponse(
            success=False,
            stage_id=4,
            passed=False,
            score_awarded=0.0,
            total_stage_score=progress["score"],
            message=verif["message"],
            feedback={"failures": verif.get("failures", [])}
        )

# ── GAME 5: PRINTING PRESS ML ──────────────────────────────────────────────────

@router.get("/5/info")
def get_game5_info(team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 5)
    return get_dataset_info()

@router.post("/5/run")
def run_game5_model(payload: CodeRunRequest, team_id: str = Depends(phase1_team_id)):
    ProgressionEngine.verify_stage_access(team_id, 5)
    return evaluate_ml_model(payload.code)

@router.post("/5/submit", response_model=GenericSubmissionResponse)
def submit_game5(payload: Game5Submission, team_id: str = Depends(phase1_team_id)):
    progress = ProgressionEngine.verify_stage_access(team_id, 5)

    existing = ProgressionEngine.check_idempotency(team_id, 5, payload.idempotency_key)
    if existing:
        return GenericSubmissionResponse(
            success=True,
            stage_id=5,
            passed=bool(existing["passed"]),
            score_awarded=existing["score_awarded"],
            total_stage_score=progress["score"],
            message="Idempotent: Returning previously recorded submission result."
        )

    verif = evaluate_ml_model(payload.code)
    hints_used = decode_json(progress["hints_used"], [])
    wrong_attempts = progress["wrong_attempts"]

    score_res = calculate_game5_score(
        error_pct=verif.get("error_pct", 100.0),
        wrong_attempts=wrong_attempts + (0 if verif["passed"] else 1),
        hints_used=hints_used,
        passed=verif["passed"]
    )
    score_awarded = score_res["score"]

    ProgressionEngine.record_submission_attempt(
        team_id=team_id,
        stage_id=5,
        idempotency_key=payload.idempotency_key,
        payload={"code_length": len(payload.code)},
        passed=verif["passed"],
        score_awarded=score_awarded,
        feedback=verif["message"]
    )

    if verif["passed"]:
        ProgressionEngine.complete_stage(
            team_id=team_id,
            stage_id=5,
            final_score=score_awarded,
            metadata={"error_pct": verif.get("error_pct"), "breakdown": score_res["breakdown"]}
        )
        return GenericSubmissionResponse(
            success=True,
            stage_id=5,
            passed=True,
            score_awarded=score_awarded,
            total_stage_score=score_awarded,
            message=verif["message"],
            feedback={"error_pct": verif.get("error_pct"), "image": verif.get("image"), "breakdown": score_res["breakdown"]},
            next_stage=None,
            mission_complete=True
        )
    else:
        return GenericSubmissionResponse(
            success=False,
            stage_id=5,
            passed=False,
            score_awarded=0.0,
            total_stage_score=progress["score"],
            message=verif["message"],
            feedback={"stdout": verif.get("stdout"), "stderr": verif.get("stderr")}
        )
