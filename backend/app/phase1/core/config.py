import os
from pydantic_settings import BaseSettings
from typing import Dict, Any, List

class Settings(BaseSettings):
    APP_NAME: str = "CODEVERSE 2.0 — Royal Mint Heist Unified Engine"
    API_V1_STR: str = "/api"
    ADMIN_PASSCODE: str = os.getenv("ADMIN_PASSCODE", "PROFESSOR_2026")
    
    # Supabase service credentials are required and must remain server-side.
    SUPABASE_URL: str
    SUPABASE_KEY: str
    
    # Secret Tokens
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-royal-mint-professor-token-2026")
    
    # Stage IDs & Names
    TOTAL_STAGES: int = 5
    STAGE_NAMES: Dict[int, str] = {
        1: "Vault Breach (Logic/Cryptography)",
        2: "Alarm System (Debugging)",
        3: "Hidden Blueprint (Web Investigation)",
        4: "The Leak + Mint Map (Data/Algorithms)",
        5: "Printing Press (Machine Learning)"
    }
    
    # Skip Penalty (configurable)
    SKIP_AWARD_POINTS: float = 0.0 # Score awarded for skipped game
    SKIP_PENALTY_DEDUCTION: float = 0.0 # Extra deduction from total score if configured
    
    # Configurable Scoring Rules (Max score for ANY game is strictly 10.0 points)
    MAX_SCORE_PER_GAME: float = 10.0
    
    SCORING_CONFIG: Dict[str, Any] = {
        "game_1": {
            "type": "hybrid", # time + attempts
            "max_score": 10.0,
            "duration_seconds": 900,
            "min_time_factor": 0.6, # min 60% of base if solved within time
            "wrong_attempt_penalty": 0.5, # 0.5 pts deduction per wrong attempt
            "hint_penalties": [0.5, 1.0, 1.5], # points deduction per hint tier
            "speed_bonus_threshold": 300, # seconds elapsed for speed bonus
            "speed_bonus_points": 0.5,
        },
        "game_2": {
            "type": "time_based",
            "max_score": 10.0,
            "duration_seconds": 900,
            "fast_solve_seconds": 120, # <= 2 mins gives 10.0 points
            "min_completion_points": 1.0,
            "wrong_attempt_penalty": 0.25,
            "hint_penalties": [0.5, 1.0],
        },
        "game_3": {
            "type": "hybrid",
            "max_score": 10.0,
            "duration_seconds": 600,
            "min_time_factor": 0.7,
            "wrong_attempt_penalty": 0.5,
            "hint_penalties": [0.5, 1.0],
        },
        "game_4": {
            "type": "approach_quality", # Path efficiency: Risk + 2 * Time
            "max_score": 10.0,
            "optimal_cost": 156.0, # Baseline known lowest cost path
            "max_acceptable_cost": 300.0,
            "min_valid_points": 4.0,
            "wrong_attempt_penalty": 0.2,
            "hint_penalties": [0.5],
        },
        "game_5": {
            "type": "quality_accuracy", # ML Regression test error %
            "max_score": 10.0,
            "error_brackets": [
                {"max_error_pct": 2.0, "points": 10.0},
                {"max_error_pct": 5.0, "points": 9.5},
                {"max_error_pct": 10.0, "points": 8.5},
                {"max_error_pct": 15.0, "points": 7.5},
                {"max_error_pct": 20.0, "points": 6.0},
                {"max_error_pct": 30.0, "points": 4.0},
                {"max_error_pct": 50.0, "points": 2.0},
            ],
            "wrong_attempt_penalty": 0.1,
            "hint_penalties": [0.5, 1.0],
        }
    }

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
