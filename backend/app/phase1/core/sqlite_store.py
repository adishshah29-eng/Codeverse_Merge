"""SQLite storage for Phase 1.

Phase 1 was written against the Supabase client's query-builder API
(``client.table(t).select("*").eq(c, v).order(c).limit(n).execute().data``).
This module provides the same small subset of that API on top of the shared
SQLite database, so the Phase 1 game, scoring and progression code is
unchanged. Each operation runs in its own short transaction.
"""
import json
import sqlite3
import threading
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from app.db import DATABASE_PATH, configure_connection

# Columns stored as JSON text and decoded back to Python objects on read.
JSON_COLUMNS = {
    "p1_stage_progress": {"hints_used", "metadata"},
    "p1_submissions": {"payload"},
    "p1_audit_logs": {"details"},
    "p1_dynamic_config": {"value"},
}
BOOL_COLUMNS = {
    "p1_teams": {"is_active"},
    "p1_submissions": {"passed"},
}
TABLES = {"p1_teams", "p1_stage_progress", "p1_submissions", "p1_audit_logs", "p1_dynamic_config"}

SCHEMA = """
CREATE TABLE IF NOT EXISTS p1_teams (
    id            TEXT    PRIMARY KEY,
    core_team_id  INTEGER UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    passcode      TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    current_stage INTEGER NOT NULL DEFAULT 1,
    total_score   REAL    NOT NULL DEFAULT 0.0,
    total_penalty REAL    NOT NULL DEFAULT 0.0,
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
);
CREATE TABLE IF NOT EXISTS p1_stage_progress (
    id              TEXT    PRIMARY KEY,
    team_id         TEXT    NOT NULL REFERENCES p1_teams(id) ON DELETE CASCADE,
    stage_id        INTEGER NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'LOCKED',
    score           REAL    NOT NULL DEFAULT 0.0,
    started_at      TEXT,
    completed_at    TEXT,
    attempts_count  INTEGER NOT NULL DEFAULT 0,
    wrong_attempts  INTEGER NOT NULL DEFAULT 0,
    hints_used      TEXT    NOT NULL DEFAULT '[]',
    penalty_points  REAL    NOT NULL DEFAULT 0.0,
    metadata        TEXT    NOT NULL DEFAULT '{}',
    UNIQUE(team_id, stage_id)
);
CREATE TABLE IF NOT EXISTS p1_submissions (
    id              TEXT    PRIMARY KEY,
    team_id         TEXT    NOT NULL REFERENCES p1_teams(id) ON DELETE CASCADE,
    stage_id        INTEGER NOT NULL,
    idempotency_key TEXT    NOT NULL,
    payload         TEXT    NOT NULL DEFAULT '{}',
    passed          INTEGER NOT NULL,
    score_awarded   REAL    NOT NULL,
    feedback        TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL,
    UNIQUE(team_id, stage_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS p1_audit_logs (
    id          TEXT PRIMARY KEY,
    team_id     TEXT,
    action      TEXT NOT NULL,
    details     TEXT NOT NULL DEFAULT '{}',
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS p1_dynamic_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_p1_stage_progress_team ON p1_stage_progress(team_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_p1_submissions_team_stage ON p1_submissions(team_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_p1_audit_logs_created_at ON p1_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_p1_teams_total_score ON p1_teams(total_score);
"""

_local = threading.local()


def _connection() -> sqlite3.Connection:
    """One connection per thread (FastAPI runs sync endpoints in a thread pool)."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DATABASE_PATH, timeout=30, isolation_level=None, check_same_thread=True)
        conn.row_factory = sqlite3.Row
        configure_connection(conn)
        _local.conn = conn
    return conn


def create_schema() -> None:
    _connection().executescript(SCHEMA)


def _encode(table: str, values: Dict[str, Any]) -> Dict[str, Any]:
    json_cols = JSON_COLUMNS.get(table, set())
    out = {}
    for key, value in values.items():
        if key in json_cols and not isinstance(value, str):
            value = json.dumps(value)
        elif isinstance(value, bool):
            value = int(value)
        out[key] = value
    return out


def _decode(table: str, row: sqlite3.Row) -> Dict[str, Any]:
    data = dict(row)
    for key in JSON_COLUMNS.get(table, ()):
        if isinstance(data.get(key), str):
            try:
                data[key] = json.loads(data[key])
            except ValueError:
                pass
    for key in BOOL_COLUMNS.get(table, ()):
        if key in data and data[key] is not None:
            data[key] = bool(data[key])
    return data


def _column(name: str) -> str:
    if not name.replace("_", "").isalnum():
        raise ValueError(f"Invalid column name: {name}")
    return f'"{name}"'


@dataclass
class Result:
    data: List[Dict[str, Any]]


class Query:
    def __init__(self, table: str):
        if table not in TABLES:
            raise ValueError(f"Unknown Phase 1 table: {table}")
        self.table = table
        self.op = "select"
        self.columns = "*"
        self.values: Any = None
        self.filters: List[tuple] = []
        self.order_by: Optional[tuple] = None
        self.limit_n: Optional[int] = None

    # ── builder API (subset of supabase-py) ──
    def select(self, columns: str = "*"):
        self.op, self.columns = "select", columns
        return self

    def insert(self, values):
        self.op, self.values = "insert", values
        return self

    def upsert(self, values):
        self.op, self.values = "upsert", values
        return self

    def update(self, values):
        self.op, self.values = "update", values
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, column: str, value: Any):
        self.filters.append((column, int(value) if isinstance(value, bool) else value))
        return self

    def order(self, column: str, desc: bool = False):
        self.order_by = (column, desc)
        return self

    def limit(self, n: int):
        self.limit_n = int(n)
        return self

    # ── execution ──
    def _where(self):
        if not self.filters:
            return "", []
        return " WHERE " + " AND ".join(f"{_column(c)} = ?" for c, _ in self.filters), [v for _, v in self.filters]

    def execute(self) -> Result:
        conn = _connection()
        table = f'"{self.table}"'
        where, params = self._where()

        if self.op == "select":
            cols = "*" if self.columns.strip() == "*" else ", ".join(_column(c.strip()) for c in self.columns.split(","))
            sql = f"SELECT {cols} FROM {table}{where}"
            if self.order_by:
                sql += f" ORDER BY {_column(self.order_by[0])} {'DESC' if self.order_by[1] else 'ASC'}"
            if self.limit_n is not None:
                sql += f" LIMIT {self.limit_n}"
            return Result([_decode(self.table, r) for r in conn.execute(sql, params)])

        if self.op in ("insert", "upsert"):
            rows = self.values if isinstance(self.values, list) else [self.values]
            out = []
            conn.execute("BEGIN IMMEDIATE")
            try:
                for row in rows:
                    row = _encode(self.table, row)
                    cols = ", ".join(_column(c) for c in row)
                    marks = ", ".join("?" for _ in row)
                    verb = "INSERT OR REPLACE" if self.op == "upsert" else "INSERT"
                    cur = conn.execute(f"{verb} INTO {table} ({cols}) VALUES ({marks}) RETURNING *", list(row.values()))
                    out.append(_decode(self.table, cur.fetchone()))
                conn.execute("COMMIT")
            except Exception:
                conn.execute("ROLLBACK")
                raise
            return Result(out)

        if self.op == "update":
            values = _encode(self.table, self.values)
            sets = ", ".join(f"{_column(c)} = ?" for c in values)
            cur = conn.execute(f"UPDATE {table} SET {sets}{where} RETURNING *", list(values.values()) + params)
            return Result([_decode(self.table, r) for r in cur.fetchall()])

        if self.op == "delete":
            conn.execute(f"DELETE FROM {table}{where}", params)
            return Result([])

        raise ValueError(f"Unsupported operation {self.op}")


class _Rpc:
    def __init__(self, fn: str, params: Dict[str, Any]):
        self.fn, self.params = fn, params

    def execute(self) -> Result:
        if self.fn != "p1_increment_stage_attempt":
            raise ValueError(f"Unknown RPC {self.fn}")
        # Single atomic statement (was a Postgres function in the Supabase build).
        _connection().execute(
            """UPDATE p1_stage_progress
               SET attempts_count = attempts_count + 1,
                   wrong_attempts = wrong_attempts + CASE WHEN ? THEN 0 ELSE 1 END
               WHERE team_id = ? AND stage_id = ?""",
            (int(bool(self.params["p_passed"])), self.params["p_team_id"], self.params["p_stage_id"]),
        )
        return Result([])


class Client:
    def table(self, name: str) -> Query:
        return Query(name)

    def rpc(self, fn: str, params: Dict[str, Any]) -> _Rpc:
        return _Rpc(fn, params)


client = Client()
