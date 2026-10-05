import math
from typing import Dict, Any, List
from app.phase1.core.database import get_scoring_config

def clamp_score(score: float, max_score: float = 10.0) -> float:
    """Strictly ensures no game score ever exceeds max_score (default 10.0) or drops below 0.0."""
    return max(0.0, min(float(max_score), round(float(score), 2)))

def calculate_game1_score(
    elapsed_seconds: int,
    wrong_attempts: int,
    hints_used: List[int],
    extracted_correct: bool = True
) -> Dict[str, Any]:
    """Game 1: Vault Breach — Hybrid Scoring (Time-based decay + attempt & hint penalties)."""
    cfg = get_scoring_config().get("game_1", {})
    max_score = float(cfg.get("max_score", 10.0))
    duration = int(cfg.get("duration_seconds", 900))
    min_factor = float(cfg.get("min_time_factor", 0.6))
    wrong_penalty_rate = float(cfg.get("wrong_attempt_penalty", 0.5))
    hint_penalties = cfg.get("hint_penalties", [0.5, 1.0, 1.5])
    speed_threshold = int(cfg.get("speed_bonus_threshold", 300))
    speed_bonus = float(cfg.get("speed_bonus_points", 0.5))

    if not extracted_correct:
        return {"score": 0.0, "breakdown": {"base": 0.0, "reason": "Incorrect code"}}

    # Time decay
    time_ratio = max(0.0, min(1.0, (duration - elapsed_seconds) / duration))
    # Time factor smoothly interpolates between min_factor and 1.0
    time_factor = min_factor + (1.0 - min_factor) * time_ratio
    base_score = max_score * time_factor

    # Speed bonus if finished quickly
    bonus = speed_bonus if elapsed_seconds <= speed_threshold else 0.0

    # Deductions
    attempt_penalties = wrong_attempts * wrong_penalty_rate
    hint_total = sum(hint_penalties[h] for h in hints_used if h < len(hint_penalties))

    raw_score = base_score + bonus - attempt_penalties - hint_total
    final_score = clamp_score(raw_score, max_score)

    return {
        "score": final_score,
        "breakdown": {
            "base_score": round(base_score, 2),
            "time_factor": round(time_factor, 2),
            "speed_bonus": bonus,
            "attempt_deduction": round(attempt_penalties, 2),
            "hint_deduction": round(hint_total, 2),
            "max_score": max_score
        }
    }

def calculate_game2_score(
    elapsed_seconds: int,
    wrong_attempts: int,
    hints_used: List[int],
    passed: bool
) -> Dict[str, Any]:
    """Game 2: Alarm System — Time-based decay over 900s window."""
    cfg = get_scoring_config().get("game_2", {})
    max_score = float(cfg.get("max_score", 10.0))
    duration = int(cfg.get("duration_seconds", 900))
    fast_seconds = int(cfg.get("fast_solve_seconds", 120))
    min_completion = float(cfg.get("min_completion_points", 1.0))
    wrong_penalty_rate = float(cfg.get("wrong_attempt_penalty", 0.25))
    hint_penalties = cfg.get("hint_penalties", [0.5, 1.0])

    if not passed:
        return {"score": 0.0, "breakdown": {"base": 0.0, "reason": "Failed execution"}}

    time_left = max(0, duration - elapsed_seconds)
    if elapsed_seconds <= fast_seconds:
        base_score = max_score
    elif time_left > 0:
        decay_window = duration - fast_seconds
        decay_time_left = max(0, time_left)
        # Decays from 9.5 down to min_completion
        base_score = min_completion + (decay_time_left / decay_window) * (max_score - 0.5 - min_completion)
    else:
        base_score = min_completion

    attempt_penalties = wrong_attempts * wrong_penalty_rate
    hint_total = sum(hint_penalties[h] for h in hints_used if h < len(hint_penalties))

    raw_score = base_score - attempt_penalties - hint_total
    final_score = clamp_score(raw_score, max_score)

    return {
        "score": final_score,
        "breakdown": {
            "base_score": round(base_score, 2),
            "attempt_deduction": round(attempt_penalties, 2),
            "hint_deduction": round(hint_total, 2),
            "max_score": max_score
        }
    }

def calculate_game3_score(
    elapsed_seconds: int,
    wrong_attempts: int,
    hints_used: List[int],
    passed: bool
) -> Dict[str, Any]:
    """Game 3: Hidden Blueprint — Hybrid Web Investigation Scoring."""
    cfg = get_scoring_config().get("game_3", {})
    max_score = float(cfg.get("max_score", 10.0))
    duration = int(cfg.get("duration_seconds", 600))
    min_factor = float(cfg.get("min_time_factor", 0.7))
    wrong_penalty_rate = float(cfg.get("wrong_attempt_penalty", 0.5))
    hint_penalties = cfg.get("hint_penalties", [0.5, 1.0])

    if not passed:
        return {"score": 0.0, "breakdown": {"base": 0.0, "reason": "Code denied"}}

    time_ratio = max(0.0, min(1.0, (duration - elapsed_seconds) / duration))
    time_factor = min_factor + (1.0 - min_factor) * time_ratio
    base_score = max_score * time_factor

    attempt_penalties = wrong_attempts * wrong_penalty_rate
    hint_total = sum(hint_penalties[h] for h in hints_used if h < len(hint_penalties))

    raw_score = base_score - attempt_penalties - hint_total
    final_score = clamp_score(raw_score, max_score)

    return {
        "score": final_score,
        "breakdown": {
            "base_score": round(base_score, 2),
            "time_factor": round(time_factor, 2),
            "attempt_deduction": round(attempt_penalties, 2),
            "hint_deduction": round(hint_total, 2),
            "max_score": max_score
        }
    }

def calculate_game4_score(
    route_cost: float,
    wrong_attempts: int,
    hints_used: List[int],
    passed: bool
) -> Dict[str, Any]:
    """Game 4: Mint Map — Approach / Quality-based Scoring (Path Efficiency = Risk + 2*Time)."""
    cfg = get_scoring_config().get("game_4", {})
    max_score = float(cfg.get("max_score", 10.0))
    optimal_cost = float(cfg.get("optimal_cost", 156.0))
    max_acceptable_cost = float(cfg.get("max_acceptable_cost", 300.0))
    min_valid = float(cfg.get("min_valid_points", 4.0))
    wrong_penalty_rate = float(cfg.get("wrong_attempt_penalty", 0.2))
    hint_penalties = cfg.get("hint_penalties", [0.5])

    if not passed:
        return {"score": 0.0, "breakdown": {"base": 0.0, "reason": "Invalid route"}}

    # Route quality formula: lower cost is better
    if route_cost <= optimal_cost:
        base_score = max_score
    elif route_cost >= max_acceptable_cost:
        base_score = min_valid
    else:
        # Linear interpolation between optimal (10.0) and acceptable (min_valid)
        cost_range = max_acceptable_cost - optimal_cost
        excess = route_cost - optimal_cost
        base_score = max_score - (excess / cost_range) * (max_score - min_valid)

    attempt_penalties = wrong_attempts * wrong_penalty_rate
    hint_total = sum(hint_penalties[h] for h in hints_used if h < len(hint_penalties))

    raw_score = base_score - attempt_penalties - hint_total
    final_score = clamp_score(raw_score, max_score)

    return {
        "score": final_score,
        "breakdown": {
            "route_cost": round(route_cost, 2),
            "base_score": round(base_score, 2),
            "attempt_deduction": round(attempt_penalties, 2),
            "hint_deduction": round(hint_total, 2),
            "max_score": max_score
        }
    }

def calculate_game5_score(
    error_pct: float,
    wrong_attempts: int,
    hints_used: List[int],
    passed: bool
) -> Dict[str, Any]:
    """Game 5: Printing Press ML — Quality / Benchmark Error Scoring."""
    cfg = get_scoring_config().get("game_5", {})
    max_score = float(cfg.get("max_score", 10.0))
    brackets = cfg.get("error_brackets", [
        {"max_error_pct": 2.0, "points": 10.0},
        {"max_error_pct": 5.0, "points": 9.5},
        {"max_error_pct": 10.0, "points": 8.5},
        {"max_error_pct": 15.0, "points": 7.5},
        {"max_error_pct": 20.0, "points": 6.0},
        {"max_error_pct": 30.0, "points": 4.0},
        {"max_error_pct": 50.0, "points": 2.0},
    ])
    wrong_penalty_rate = float(cfg.get("wrong_attempt_penalty", 0.1))
    hint_penalties = cfg.get("hint_penalties", [0.5, 1.0])

    if not passed:
        return {"score": 0.0, "breakdown": {"base": 0.0, "reason": "Model validation failed"}}

    base_score = 0.0
    for bracket in brackets:
        if error_pct <= bracket["max_error_pct"]:
            base_score = float(bracket["points"])
            break

    attempt_penalties = wrong_attempts * wrong_penalty_rate
    hint_total = sum(hint_penalties[h] for h in hints_used if h < len(hint_penalties))

    raw_score = base_score - attempt_penalties - hint_total
    final_score = clamp_score(raw_score, max_score)

    return {
        "score": final_score,
        "breakdown": {
            "error_pct": round(error_pct, 2),
            "base_score": round(base_score, 2),
            "attempt_deduction": round(attempt_penalties, 2),
            "hint_deduction": round(hint_total, 2),
            "max_score": max_score
        }
    }
