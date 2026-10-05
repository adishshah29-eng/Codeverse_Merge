-- ============================================================================
-- CODEVERSE 2.0 — UNIFIED SUPABASE POSTGRESQL SCHEMA (Phase 1 + Phase 2)
--
-- Run this whole file once in the Supabase SQL Editor. It is idempotent
-- (safe to re-run). Sections:
--   A. Shared + Phase 2 tables   (teams, stage_progress, config_kv, ...)
--   B. Phase 1 tables            (p1_teams, p1_stage_progress, ...)
--   C. Security                  (RLS on every table, forensic read-only role)
-- ============================================================================

-- ── A. SHARED + PHASE 2 ─────────────────────────────────────────────────────
-- `teams` is the single team identity for the whole platform: one row per
-- Supabase Auth account, created from the admin panel (TEAM ACCOUNTS).

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
CREATE INDEX IF NOT EXISTS idx_audit_events_team_type ON audit_events(team_id, event_type, id DESC);

-- ── B. PHASE 1 (Royal Mint Heist) ───────────────────────────────────────────
-- Prefixed with p1_ so they do not collide with the Phase 2 tables above.
-- Each p1_teams row is linked 1:1 to a shared `teams` row (core_team_id) and
-- is created automatically the first time that team opens Phase 1.

CREATE TABLE IF NOT EXISTS p1_teams (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    core_team_id  INTEGER     UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    passcode      TEXT,                       -- legacy (pre-unification); unused
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    current_stage INTEGER     NOT NULL DEFAULT 1,
    total_score   FLOAT       NOT NULL DEFAULT 0.0,
    total_penalty FLOAT       NOT NULL DEFAULT 0.0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS p1_stage_progress (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID        NOT NULL REFERENCES p1_teams(id) ON DELETE CASCADE,
    stage_id        INTEGER     NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'LOCKED',  -- LOCKED | ACTIVE | COMPLETED | SKIPPED
    score           FLOAT       NOT NULL DEFAULT 0.0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    attempts_count  INTEGER     NOT NULL DEFAULT 0,
    wrong_attempts  INTEGER     NOT NULL DEFAULT 0,
    hints_used      JSONB       NOT NULL DEFAULT '[]'::jsonb,
    penalty_points  FLOAT       NOT NULL DEFAULT 0.0,
    metadata        JSONB       NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(team_id, stage_id)
);

CREATE TABLE IF NOT EXISTS p1_submissions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID        NOT NULL REFERENCES p1_teams(id) ON DELETE CASCADE,
    stage_id        INTEGER     NOT NULL,
    idempotency_key TEXT        NOT NULL,
    payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    passed          BOOLEAN     NOT NULL,
    score_awarded   FLOAT       NOT NULL,
    feedback        TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, stage_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS p1_audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID,
    action      TEXT        NOT NULL,
    details     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS p1_dynamic_config (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_p1_stage_progress_team_id    ON p1_stage_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_p1_stage_progress_team_stage ON p1_stage_progress(team_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_p1_submissions_team_stage    ON p1_submissions(team_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_p1_submissions_idempotency   ON p1_submissions(team_id, stage_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_p1_audit_logs_team_id        ON p1_audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_p1_audit_logs_created_at     ON p1_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_p1_teams_total_score         ON p1_teams(total_score DESC);

CREATE OR REPLACE FUNCTION p1_increment_stage_attempt(
    p_team_id UUID,
    p_stage_id INTEGER,
    p_passed BOOLEAN
)
RETURNS VOID
LANGUAGE SQL
SET search_path = public
AS $$
    UPDATE p1_stage_progress
    SET attempts_count = attempts_count + 1,
        wrong_attempts = wrong_attempts + CASE WHEN p_passed THEN 0 ELSE 1 END
    WHERE team_id = p_team_id AND stage_id = p_stage_id;
$$;

REVOKE ALL ON FUNCTION p1_increment_stage_attempt(UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION p1_increment_stage_attempt(UUID, INTEGER, BOOLEAN) TO service_role;

-- ── C. SECURITY ─────────────────────────────────────────────────────────────
-- The backend talks to the database as `postgres` (DATABASE_URL) or
-- `service_role` (Supabase REST), both of which bypass RLS. Enabling RLS with
-- no policies means the public anon/authenticated keys can read nothing
-- through the Supabase REST API (answers in config_kv, team data, ...).
DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'teams','stage_progress','game_outputs','config_kv','audit_events',
        'submissions','hint_catalog','hint_uses','penalties','market_purchases',
        'ctf_state','police_clock','team_compromises','event_clock',
        'transactions','employees','access_cards','terminal_logs','security_events',
        'p1_teams','p1_stage_progress','p1_submissions','p1_audit_logs','p1_dynamic_config'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- Phase 2 / Stage 1 lets teams run their own SELECT queries. Those queries must
-- NOT run as `postgres` (which could read config_kv answers or auth.users).
-- This role can only read the five forensic tables. The backend connects with
-- it through FORENSIC_DATABASE_URL. After running this file, give it a login
-- password ONCE (pick your own strong value):
--     ALTER ROLE forensic_reader WITH LOGIN PASSWORD '<strong-password>';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'forensic_reader') THEN
        CREATE ROLE forensic_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END $$;
ALTER ROLE forensic_reader SET statement_timeout = '5s';
GRANT USAGE ON SCHEMA public TO forensic_reader;
GRANT SELECT ON transactions, employees, access_cards, terminal_logs, security_events TO forensic_reader;
DROP POLICY IF EXISTS forensic_read ON transactions;
DROP POLICY IF EXISTS forensic_read ON employees;
DROP POLICY IF EXISTS forensic_read ON access_cards;
DROP POLICY IF EXISTS forensic_read ON terminal_logs;
DROP POLICY IF EXISTS forensic_read ON security_events;
CREATE POLICY forensic_read ON transactions    FOR SELECT TO forensic_reader USING (true);
CREATE POLICY forensic_read ON employees       FOR SELECT TO forensic_reader USING (true);
CREATE POLICY forensic_read ON access_cards    FOR SELECT TO forensic_reader USING (true);
CREATE POLICY forensic_read ON terminal_logs   FOR SELECT TO forensic_reader USING (true);
CREATE POLICY forensic_read ON security_events FOR SELECT TO forensic_reader USING (true);
