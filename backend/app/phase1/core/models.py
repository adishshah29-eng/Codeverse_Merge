from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any

class HintRequest(BaseModel):
    stage_id: int = Field(..., ge=1, le=10)
    hint_index: int = Field(..., ge=0, le=10)

class SkipStageRequest(BaseModel):
    stage_id: int = Field(..., ge=1, le=10)
    confirmation: bool = True

class StageStatusResponse(BaseModel):
    stage_id: int
    stage_name: str
    status: str # LOCKED, ACTIVE, COMPLETED, SKIPPED
    score: float
    max_score: float = 10.0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    time_elapsed_seconds: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    attempts_count: int = 0
    wrong_attempts: int = 0
    hints_used: List[int] = []
    penalty_points: float = 0.0

class TeamDashboardResponse(BaseModel):
    team_id: str
    team_name: str
    current_stage: int
    total_score: float
    total_penalty: float
    stages: List[StageStatusResponse]
    rank: Optional[int] = None
    total_teams: int = 0
    debug_unlock_all: bool = False

class LeaderboardEntry(BaseModel):
    rank: int
    team_id: str
    team_name: str
    current_stage: int
    total_score: float
    total_penalty: float
    stage_scores: Dict[str, float]
    completed_stages_count: int
    last_activity: str

class LeaderboardResponse(BaseModel):
    leaderboard: List[LeaderboardEntry]
    updated_at: str

# ── Game Submission Request Models ─────────────────────────────────────────────

IdempotencyKey = Field(..., min_length=1, max_length=128)
MAX_CODE_CHARS = 100_000

class Game1Submission(BaseModel):
    idempotency_key: str = IdempotencyKey
    final_code: str = Field(..., max_length=32)
    extracted_door: Optional[int] = None
    extracted_witness: Optional[int] = None
    extracted_metal: Optional[int] = None
    shift: Optional[int] = None

class Game2Submission(BaseModel):
    idempotency_key: str = IdempotencyKey
    challenge_id: str = Field(..., max_length=64)
    code: str = Field(..., max_length=MAX_CODE_CHARS)
    time_spent_seconds: Optional[int] = 0  # ignored: elapsed time is computed server-side

class Game3Submission(BaseModel):
    idempotency_key: str = IdempotencyKey
    extraction_code: str = Field(..., max_length=64)
    blueprint_fragment: Optional[str] = Field(None, max_length=64)

class Game4Submission(BaseModel):
    idempotency_key: str = IdempotencyKey
    route: List[int] = Field(..., max_length=64)

class Game5Submission(BaseModel):
    idempotency_key: str = IdempotencyKey
    code: str = Field(..., max_length=MAX_CODE_CHARS)

class StageSubmission(BaseModel):
    """One submission for any Phase 1 stage.

    files   — source files (path -> text), e.g. {"shortener.py": "..."} or {"app/crud.py": "..."}
    answers — named text fields, e.g. {"password": "...", "note": "..."}
    """
    idempotency_key: str = IdempotencyKey
    files: Dict[str, str] = Field(default_factory=dict)
    answers: Dict[str, str] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _limits(self):
        if len(self.files) > 20:
            raise ValueError("Too many files (max 20).")
        if any(len(path) > 120 or len(text) > MAX_CODE_CHARS for path, text in self.files.items()):
            raise ValueError("A file is too large or its path is too long.")
        if sum(len(text) for text in self.files.values()) > 3 * MAX_CODE_CHARS:
            raise ValueError("Submission is too large.")
        if len(self.answers) > 20 or any(len(key) > 40 or len(value) > 4000 for key, value in self.answers.items()):
            raise ValueError("An answer field is too long.")
        return self

class GenericSubmissionResponse(BaseModel):
    success: bool
    stage_id: int
    passed: bool
    score_awarded: float
    total_stage_score: float
    message: str
    feedback: Optional[Dict[str, Any]] = None
    next_stage: Optional[int] = None
    mission_complete: bool = False

class AdminTeamUpdate(BaseModel):
    is_active: Optional[bool] = None
    current_stage: Optional[int] = None
    reset_to_stage_1: Optional[bool] = None
