from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TeamRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    passcode: str = Field(..., min_length=3, max_length=50)

class TeamLoginRequest(BaseModel):
    name: str
    passcode: str

class AdminLoginRequest(BaseModel):
    passcode: str

class HintRequest(BaseModel):
    stage_id: int
    hint_index: int

class SkipStageRequest(BaseModel):
    stage_id: int
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

class Game1Submission(BaseModel):
    idempotency_key: str
    final_code: str # Expected "615870"
    extracted_door: Optional[int] = None
    extracted_witness: Optional[int] = None
    extracted_metal: Optional[int] = None
    shift: Optional[int] = None

class Game2Submission(BaseModel):
    idempotency_key: str
    challenge_id: str
    code: str
    time_spent_seconds: Optional[int] = 0

class Game3Submission(BaseModel):
    idempotency_key: str
    extraction_code: str # Expected "RM-630417"
    blueprint_fragment: Optional[str] = None # "17-04"

class Game4Submission(BaseModel):
    idempotency_key: str
    route: List[int] # e.g. [0, 2, 5, 8, 12, 16, 20]

class Game5Submission(BaseModel):
    idempotency_key: str
    code: str # Python model code

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
