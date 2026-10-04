-- =============================================================================
-- CODEVERSE 2.0 — Royal Mint Heist Unified Platform
-- Supabase PostgreSQL Schema
-- Run this entire script once in the Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql/new
-- =============================================================================

-- ── 1. TEAMS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        UNIQUE NOT NULL,
    passcode    TEXT        NOT NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    current_stage INTEGER   NOT NULL DEFAULT 1,
    total_score FLOAT       NOT NULL DEFAULT 0.0,
    total_penalty FLOAT     NOT NULL DEFAULT 0.0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. STAGE PROGRESS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stage_progress (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
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

-- ── 3. SUBMISSIONS (Idempotency + Anti-cheat) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS submissions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    stage_id        INTEGER     NOT NULL,
    idempotency_key TEXT        NOT NULL,
    payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    passed          BOOLEAN     NOT NULL,
    score_awarded   FLOAT       NOT NULL,
    feedback        TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, stage_id, idempotency_key)
);

-- ── 4. AUDIT LOG ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID,
    action      TEXT        NOT NULL,
    details     JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 5. DYNAMIC CONFIG (Scoring rules — hot-updatable) ────────────────────────

CREATE TABLE IF NOT EXISTS dynamic_config (
    key         TEXT        PRIMARY KEY,
    value       JSONB       NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stage_progress_team_id   ON stage_progress(team_id);
CREATE INDEX IF NOT EXISTS idx_stage_progress_team_stage ON stage_progress(team_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team_stage    ON submissions(team_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_submissions_idempotency   ON submissions(team_id, stage_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team_id        ON audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at     ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_teams_total_score         ON teams(total_score DESC);

-- ── ATOMIC OPERATIONS ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_stage_attempt(
    p_team_id UUID,
    p_stage_id INTEGER,
    p_passed BOOLEAN
)
RETURNS VOID
LANGUAGE SQL
AS $$
    UPDATE stage_progress
    SET attempts_count = attempts_count + 1,
        wrong_attempts = wrong_attempts + CASE WHEN p_passed THEN 0 ELSE 1 END
    WHERE team_id = p_team_id AND stage_id = p_stage_id;
$$;

REVOKE ALL ON FUNCTION increment_stage_attempt(UUID, INTEGER, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_stage_attempt(UUID, INTEGER, BOOLEAN) TO service_role;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────────
-- Backend requests use service_role, which bypasses RLS. Public clients receive no policies.

ALTER TABLE teams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dynamic_config ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- DONE. Tables created:
--   teams | stage_progress | submissions | audit_logs | dynamic_config
-- =============================================================================
