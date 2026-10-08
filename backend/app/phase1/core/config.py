from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Dict, Any, List

from app.settings import BACKEND_DIR


class Settings(BaseSettings):
    APP_NAME: str = "CODEVERSE 2.0 — Phase 1 Challenge Arena"

    # Stage IDs & Names (competition/ has the handout, tests and answer key for each)
    TOTAL_STAGES: int = 5
    STAGE_NAMES: Dict[int, str] = {
        1: "URL Shortener (Systems / Optimization)",
        2: "TODO API Bug Hunt (Debugging)",
        3: "CTF Binary (Security / Reversing)",
        4: "Spreadsheet Engine (Parsing / Graphs)",
        5: "Linear Regression (ML / Diagnosis)",
    }

    # Skip Penalty (configurable)
    SKIP_AWARD_POINTS: float = 0.0 # Score awarded for skipped game
    SKIP_PENALTY_DEDUCTION: float = 0.0 # Extra deduction from total score if configured

    # Configurable Scoring Rules (Max score for ANY game is strictly 10.0 points).
    # Each stage grader awards 0-10 raw points; a team's score is its best raw grade minus
    # hint penalties (by hint index) and wrong_attempt_penalty per unusable/wrong submission.
    # duration_seconds is the suggested time box shown in the UI (not enforced).
    MAX_SCORE_PER_GAME: float = 10.0

    SCORING_CONFIG: Dict[str, Any] = {
        "game_1": {"max_score": 10.0, "duration_seconds": 3600, "wrong_attempt_penalty": 0.0,
                   "hint_penalties": [0.5, 1.0, 1.5]},
        "game_2": {"max_score": 10.0, "duration_seconds": 3600, "wrong_attempt_penalty": 0.0,
                   "hint_penalties": [0.5, 1.0, 1.5]},
        "game_3": {"max_score": 10.0, "duration_seconds": 3600, "wrong_attempt_penalty": 0.25,
                   "hint_penalties": [0.5, 1.0, 1.5]},
        "game_4": {"max_score": 10.0, "duration_seconds": 5400, "wrong_attempt_penalty": 0.0,
                   "hint_penalties": [0.5, 1.0, 1.5]},
        "game_5": {"max_score": 10.0, "duration_seconds": 5400, "wrong_attempt_penalty": 0.0,
                   "hint_penalties": [0.5, 1.0, 1.5]},
    }

    # Only PHASE1_-prefixed variables (e.g. PHASE1_SKIP_AWARD_POINTS) override
    # the defaults above, so shared platform variables are not re-read here.
    model_config = SettingsConfigDict(env_prefix="PHASE1_", env_file=str(BACKEND_DIR / ".env"), extra="ignore")

settings = Settings()
