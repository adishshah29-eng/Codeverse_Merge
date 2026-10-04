-- ============================================================================
-- CODEVERSE 2.0: HEIST GAME - SUPABASE POSTGRESQL SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255),
    supabase_user_id VARCHAR(64) UNIQUE,
    money INTEGER DEFAULT 10000,
    risk DOUBLE PRECISION DEFAULT 0.0,
    current_stage INTEGER DEFAULT 1,
    black_market_unlocked BOOLEAN DEFAULT FALSE,
    black_market_purchases INTEGER DEFAULT 0,
    final_score DOUBLE PRECISION,
    event_started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Upgrade existing installations from local team-password authentication.
ALTER TABLE teams ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_supabase_user_id
    ON teams(supabase_user_id) WHERE supabase_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stage_progress (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    stage INTEGER NOT NULL,
    status VARCHAR(24) DEFAULT 'locked', -- locked | open | completed | skipped
    score DOUBLE PRECISION DEFAULT 0.0,  -- max 10.0 per stage
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_team_stage UNIQUE (team_id, stage)
);

CREATE TABLE IF NOT EXISTS game_outputs (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    key VARCHAR(64) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_team_output UNIQUE (team_id, key)
);

CREATE TABLE IF NOT EXISTS config_kv (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    payload TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    stage VARCHAR(32) NOT NULL,
    accepted BOOLEAN DEFAULT FALSE,
    reason TEXT DEFAULT '',
    payload TEXT DEFAULT '{}',
    score DOUBLE PRECISION,
    event_t DOUBLE PRECISION,
    route_code VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hint_catalog (
    id VARCHAR(64) PRIMARY KEY,
    stage INTEGER NOT NULL,
    title VARCHAR(120) NOT NULL,
    body TEXT NOT NULL,
    penalty DOUBLE PRECISION DEFAULT 1.0,
    enabled BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hint_uses (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    hint_id VARCHAR(64) REFERENCES hint_catalog(id) ON DELETE CASCADE,
    penalty DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_hint_use UNIQUE (team_id, hint_id)
);

CREATE TABLE IF NOT EXISTS penalties (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    reason VARCHAR(255) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    source VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_purchases (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    item_id VARCHAR(64) NOT NULL,
    category VARCHAR(32) NOT NULL,
    price INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ctf_state (
    team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    lives INTEGER DEFAULT 3,
    score INTEGER DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    balance_request_count INTEGER DEFAULT 0,
    puzzles_json TEXT DEFAULT '{}',
    submission_timestamps TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS police_clock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    t DOUBLE PRECISION DEFAULT 0.0,
    running BOOLEAN DEFAULT FALSE,
    wall_started DOUBLE PRECISION,
    compromised_json TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS team_compromises (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    node_id VARCHAR(16) NOT NULL,
    CONSTRAINT uq_team_node UNIQUE (team_id, node_id)
);

CREATE TABLE IF NOT EXISTS event_clock (
    id INTEGER PRIMARY KEY DEFAULT 1,
    running BOOLEAN DEFAULT FALSE,
    duration_seconds INTEGER DEFAULT 7200,
    ends_at TIMESTAMP WITH TIME ZONE
);

-- Stage 1 forensic challenge data, stored in the same Supabase database.
CREATE TABLE IF NOT EXISTS transactions (
    txn_id VARCHAR(64) PRIMARY KEY,
    timestamp VARCHAR(32) NOT NULL,
    sender_account VARCHAR(128) NOT NULL,
    recipient_account VARCHAR(128) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency VARCHAR(8) NOT NULL,
    terminal_id VARCHAR(64),
    status VARCHAR(32) NOT NULL,
    memo TEXT
);

CREATE TABLE IF NOT EXISTS employees (
    emp_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    role VARCHAR(120) NOT NULL,
    department VARCHAR(120) NOT NULL,
    clearance_level INTEGER NOT NULL,
    active_badge_id VARCHAR(64) NOT NULL
);

CREATE TABLE IF NOT EXISTS access_cards (
    event_id SERIAL PRIMARY KEY,
    badge_id VARCHAR(64) NOT NULL,
    emp_id VARCHAR(64) NOT NULL,
    door_location VARCHAR(160) NOT NULL,
    timestamp VARCHAR(32) NOT NULL,
    access_granted BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS terminal_logs (
    log_id SERIAL PRIMARY KEY,
    terminal_id VARCHAR(64) NOT NULL,
    emp_id VARCHAR(64) NOT NULL,
    login_time VARCHAR(32) NOT NULL,
    logout_time VARCHAR(32),
    command_history TEXT,
    ip_address VARCHAR(48) NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
    event_id SERIAL PRIMARY KEY,
    timestamp VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    location VARCHAR(160) NOT NULL,
    severity VARCHAR(24) NOT NULL,
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stage_progress_team ON stage_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_team ON audit_events(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_penalties_team ON penalties(team_id);
CREATE INDEX IF NOT EXISTS idx_market_purchases_team ON market_purchases(team_id);
