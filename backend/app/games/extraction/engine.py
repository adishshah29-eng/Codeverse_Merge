"""
Stage 4: Final Extraction Engine
Validates the 4 prerequisite artifacts:
1. Deletion Key (Stage 1)
2. Shutdown Code (Phase 1 / Royal Mint)
3. Control Token (Stage 2)
4. Route Code (Stage 3)

Followed by the 5-command security sequence puzzle.

SECURITY: No correct answers are hardcoded here.
          All expected values come from ConfigKV or the team's game outputs.
"""
from typing import Any, Dict, List, Tuple

def verify_artifacts(
    deletion_key: str,
    shutdown_code: str,
    control_token: str,
    route_code: str,
    expected_outputs: Dict[str, str],
    expected_shutdown: str = None,
) -> Dict[str, Any]:
    """
    Validates the 4 artifacts against stored team outputs and server config.
    Returns per-field validation results and overall status.
    expected_outputs: team's GameOutput rows (server-side)
    expected_shutdown: correct shutdown code from ConfigKV
    """
    def norm(v: str) -> str:
        return (v or "").strip().upper()

    exp_deletion = norm(expected_outputs.get("deletion_key", ""))
    exp_shutdown = norm(expected_shutdown)
    exp_control = norm(expected_outputs.get("control_token", ""))
    exp_route = norm(expected_outputs.get("route_code", ""))

    checks = {
        "deletion_key": {
            "valid": bool(exp_deletion) and norm(deletion_key) == exp_deletion,
            "label": "Deletion Key (Stage 1)",
        },
        "shutdown_code": {
            "valid": bool(exp_shutdown) and norm(shutdown_code) == exp_shutdown,
            "label": "Shutdown Code (Vault Mainframe)",
        },
        "control_token": {
            "valid": bool(exp_control) and (not norm(control_token) or norm(control_token) == exp_control),
            "label": "Control Server Token (Stage 2)",
        },
        "route_code": {
            "valid": bool(exp_route) and (not norm(route_code) or norm(route_code) == exp_route),
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


def verify_sequence_order(sequence: List[str], expected_sequence: List[str] = None) -> Tuple[bool, str]:
    """Validates the 5-step command sequence puzzle.
    expected_sequence comes from ConfigKV (server-authoritative).
    """
    expected = expected_sequence or []
    if not expected:
        return False, "Extraction sequence is not configured."
    if len(sequence) != len(expected):
        return False, f"Sequence must contain exactly {len(expected)} commands."

    clean_sequence = [s.strip().lower() for s in sequence]
    if clean_sequence == expected:
        return True, "Sequence authorized! Subsystems bypassed. Extraction in progress!"

    return False, "Incorrect execution order. Subsystems triggered safety rollback."


def calculate_final_heist_score(
    stage_scores_sum: float,
    total_penalties: float,
    remaining_money: int,
    accumulated_risk: float,
    remaining_time_seconds: int,
    money_divisor: float,
    risk_multiplier: float,
    time_multiplier: float,
) -> float:
    """
    Authoritative final score calculation with configurable multipliers.
    All multiplier values come from ConfigKV via the router.
    - Stage scores: max 40 points total (10 per stage)
    - Penalties: deducted directly
    - Money multiplier: configurable (default 1 pt per 1,000 remaining funds)
    - Risk deduction: configurable (default 0.2 pt per risk unit accumulated)
    - Speed bonus: configurable (default 0.01 pt per remaining second)
    """
    money_bonus = max(0, remaining_money) / money_divisor
    risk_cost = accumulated_risk * risk_multiplier
    time_bonus = max(0, remaining_time_seconds) * time_multiplier

    raw_score = stage_scores_sum - total_penalties + money_bonus - risk_cost + time_bonus
    return round(max(0.0, raw_score), 2)
