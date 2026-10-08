from typing import Any, Dict, List

from app.phase1.core.database import get_scoring_config


def clamp_score(score: float, max_score: float = 10.0) -> float:
    """Strictly ensures no stage score ever exceeds max_score (default 10.0) or drops below 0.0."""
    return max(0.0, min(float(max_score), round(float(score), 2)))


def net_stage_score(stage_id: int, best_raw: float, wrong_attempts: int, hints_used: List[int]) -> Dict[str, Any]:
    """Score a stage: the team's best raw grade, minus hint and wrong-attempt deductions.

    Raw grades (0–10) come from the stage grader (see games/g*.py). Deductions are configurable per stage in
    the admin config: ``hint_penalties`` (by hint index) and ``wrong_attempt_penalty`` (per unusable / wrong submission).
    """
    cfg = get_scoring_config().get(f"game_{stage_id}", {})
    max_score = float(cfg.get("max_score", 10.0))
    hint_penalties = cfg.get("hint_penalties", [0.5, 1.0, 1.5])
    hint_total = sum(hint_penalties[h] for h in hints_used if 0 <= h < len(hint_penalties))
    attempt_total = wrong_attempts * float(cfg.get("wrong_attempt_penalty", 0.0))
    final = clamp_score(best_raw - hint_total - attempt_total, max_score) if best_raw > 0 else 0.0
    return {
        "score": final,
        "breakdown": {
            "best_raw_score": round(best_raw, 2),
            "hint_deduction": round(hint_total, 2),
            "attempt_deduction": round(attempt_total, 2),
            "max_score": max_score,
        },
    }
