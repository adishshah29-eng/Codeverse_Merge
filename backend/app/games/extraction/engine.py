"""
Stage 4: Final Extraction Engine
Validates the 4 prerequisite artifacts:
1. Deletion Key (Stage 1) -> ERASE-7429
2. Shutdown Code (Phase 1 / Royal Mint) -> SILENT-031
3. Control Token (Stage 2) -> MINT-OMEGA
4. Route Code (Stage 3) -> team's computed checksum or NORTH-07

Followed by the 5-command security sequence puzzle:
Sequence: surveillance -> alarm -> locks -> passage -> crew
"""
from typing import Any, Dict, List, Tuple

DEFAULT_SHUTDOWN_CODE = "SILENT-031"
EXPECTED_SEQUENCE = ["surveillance", "alarm", "locks", "passage", "crew"]


def verify_artifacts(
    deletion_key: str,
    shutdown_code: str,
    control_token: str,
    route_code: str,
    expected_outputs: Dict[str, str],
) -> Dict[str, Any]:
    """
    Validates the 4 artifacts against stored team outputs and event keys.
    Returns per-field validation results and overall status.
    """
    def norm(v: str) -> str:
        return (v or "").strip().upper()

    expected_deletion = expected_outputs.get("deletion_key", "ERASE-7429").strip().upper()
    expected_shutdown = expected_outputs.get("shutdown_code", DEFAULT_SHUTDOWN_CODE).strip().upper()
    expected_control = expected_outputs.get("control_token", "MINT-OMEGA").strip().upper()
    expected_route = expected_outputs.get("route_code", "NORTH-07").strip().upper()

    checks = {
        "deletion_key": {
            "valid": norm(deletion_key) == expected_deletion,
            "label": "Deletion Key (Stage 1)",
        },
        "shutdown_code": {
            "valid": norm(shutdown_code) == expected_shutdown,
            "label": "Shutdown Code (Vault Mainframe)",
        },
        "control_token": {
            "valid": norm(control_token) == expected_control,
            "label": "Control Server Token (Stage 2)",
        },
        "route_code": {
            "valid": norm(route_code) == expected_route or norm(route_code) == "NORTH-07",
            "label": "Escape Route Code (Stage 3)",
        },
    }

    all_valid = all(item["valid"] for item in checks.values())
    return {
        "all_valid": all_valid,
        "fields": checks,
        "message": "All perimeter credentials verified! Final extraction sequence unlocked."
        if all_valid
        else "Credential mismatch detected. Verify your stage outputs.",
    }


def verify_sequence_order(sequence: List[str]) -> Tuple[bool, str]:
    """Validates the 5-step command sequence puzzle."""
    if len(sequence) != len(EXPECTED_SEQUENCE):
        return False, f"Sequence must contain exactly {len(EXPECTED_SEQUENCE)} commands."

    clean_sequence = [s.strip().lower() for s in sequence]
    if clean_sequence == EXPECTED_SEQUENCE:
        return True, "Sequence authorized! Subsystems bypassed. Extraction in progress!"

    return False, "Incorrect execution order. Subsystems triggered safety rollback."


def calculate_final_heist_score(
    stage_scores_sum: float,
    total_penalties: float,
    remaining_money: int,
    accumulated_risk: float,
    remaining_time_seconds: int,
) -> float:
    """
    Authoritative final score calculation:
    - Stage scores: max 40 points total (10 per stage)
    - Penalties: deducted directly
    - Money multiplier: 1 pt per 1,000 remaining funds
    - Risk deduction: 0.2 pt per risk unit accumulated
    - Speed bonus: 0.01 pt per remaining second
    """
    money_bonus = max(0, remaining_money) / 1000.0
    risk_cost = accumulated_risk * 0.2
    time_bonus = max(0, remaining_time_seconds) * 0.01

    raw_score = stage_scores_sum - total_penalties + money_bonus - risk_cost + time_bonus
    return round(max(0.0, raw_score), 2)
