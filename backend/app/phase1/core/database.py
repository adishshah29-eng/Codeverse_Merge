"""
core/database.py
────────────────
Supabase client singleton + helper functions.
All data is stored in Supabase PostgreSQL (JSONB columns, UUID primary keys).
The SQLite heist_unified.db is no longer used.
"""

import json
import logging
import uuid
from typing import Dict, Any, Optional
from datetime import datetime, timezone

from supabase import create_client, Client
from app.phase1.core.config import settings

logger = logging.getLogger(__name__)

# ── Supabase Client Singleton ─────────────────────────────────────────────────

_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """Returns the Supabase client singleton, creating it on first call."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _supabase_client


def select_rows(table: str, filters: Optional[Dict[str, Any]] = None, order_by: Optional[str] = None, ascending: bool = True) -> list[Dict[str, Any]]:
    query = get_supabase().table(table).select("*")
    for column, value in (filters or {}).items():
        query = query.eq(column, value)
    if order_by:
        query = query.order(order_by, desc=not ascending)
    return query.execute().data or []


def select_one(table: str, filters: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rows = select_rows(table, filters)
    return rows[0] if rows else None


def insert_row(table: str, values: Dict[str, Any]) -> Dict[str, Any]:
    result = get_supabase().table(table).insert(values).execute()
    return result.data[0] if result.data else values


def update_rows(table: str, filters: Dict[str, Any], values: Dict[str, Any]) -> list[Dict[str, Any]]:
    query = get_supabase().table(table).update(values)
    for column, value in filters.items():
        query = query.eq(column, value)
    return query.execute().data or []


def delete_rows(table: str, filters: Dict[str, Any]) -> None:
    query = get_supabase().table(table).delete()
    for column, value in filters.items():
        query = query.eq(column, value)
    query.execute()


def decode_json(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return default
    return value


# ── Startup Bootstrap ─────────────────────────────────────────────────────────

def seed_default_scoring_config():
    """
    Inserts default scoring config into dynamic_config if the 'scoring' key
    does not already exist. Safe to call on every startup.
    """
    try:
        sb = get_supabase()
        result = sb.table("p1_dynamic_config").select("key").eq("key", "scoring").execute()
        if not result.data:
            sb.table("p1_dynamic_config").insert({
                "key": "scoring",
                "value": settings.SCORING_CONFIG,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        else:
            _upgrade_game4_baseline(sb)
    except Exception as exc:
        # Non-fatal: config falls back to settings.SCORING_CONFIG
        logger.warning("Could not seed Phase 1 scoring config in Supabase: %s", exc)


# The original default (156) is below the cheapest legal Mint Map route (284),
# which capped a perfect route at 4.67 / 10. Upgrade configs that still hold
# that untouched default; any other organizer-chosen value is left alone.
_OLD_GAME4_OPTIMAL_COST = 156.0


def _upgrade_game4_baseline(sb) -> None:
    rows = sb.table("p1_dynamic_config").select("value").eq("key", "scoring").execute().data
    config = decode_json(rows[0]["value"], {}) if rows else {}
    game4 = config.get("game_4") if isinstance(config, dict) else None
    if isinstance(game4, dict) and float(game4.get("optimal_cost", 0)) == _OLD_GAME4_OPTIMAL_COST:
        game4["optimal_cost"] = settings.SCORING_CONFIG["game_4"]["optimal_cost"]
        update_scoring_config(config)
        logger.info("Phase 1 scoring: game_4.optimal_cost upgraded from 156 to %s", game4["optimal_cost"])


# ── Scoring Config Helpers ────────────────────────────────────────────────────

def get_scoring_config() -> Dict[str, Any]:
    """
    Reads scoring config from Supabase dynamic_config table.
    Falls back to settings.SCORING_CONFIG if not found or on error.
    """
    try:
        sb = get_supabase()
        result = sb.table("p1_dynamic_config").select("value").eq("key", "scoring").execute()
        if result.data:
            val = result.data[0]["value"]
            # Supabase JSONB columns are returned as Python dicts already
            return val if isinstance(val, dict) else json.loads(val)
    except Exception as exc:
        logger.warning("Could not read Phase 1 scoring config from Supabase: %s", exc)
    return settings.SCORING_CONFIG


def update_scoring_config(new_config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Upserts scoring config into dynamic_config. Returns the saved config.
    """
    sb = get_supabase()
    sb.table("p1_dynamic_config").upsert({
        "key": "scoring",
        "value": new_config,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }).execute()
    return new_config


# ── Audit Log Helper ──────────────────────────────────────────────────────────

def log_audit(action: str, details: Dict[str, Any], team_id: Optional[str] = None):
    """
    Inserts a row into audit_logs. Fire-and-forget; errors are swallowed
    so they never interrupt the main request flow.
    """
    try:
        sb = get_supabase()
        sb.table("p1_audit_logs").insert({
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "action": action,
            "details": details,
            "created_at": datetime.now(timezone.utc).isoformat()
        }).execute()
    except Exception as exc:
        logger.warning("Phase 1 audit log failed (%s): %s", action, exc)
