"""Money Trail challenge data and read-only SQL query execution."""
import logging
from typing import Any, Dict, List, Tuple

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from ...db import engine, forensic_engine
from ...settings import settings
from ...models import (
    ForensicAccessCard,
    ForensicEmployee,
    ForensicSecurityEvent,
    ForensicTerminalLog,
    ForensicTransaction,
)

_DEFAULT_ROGUE_TXN = "TXN-884920"

logger = logging.getLogger(__name__)


def init_money_trail_db(db: Session, secret_values: list[str] | None = None) -> None:
    """Seed forensic records in the shared application database and redact legacy answers."""
    if not db.query(ForensicTransaction).first():
        _seed_forensic_data(db)

    for row in db.scalars(select(ForensicTransaction)):
        for secret in secret_values or []:
            if secret and row.memo:
                row.memo = row.memo.replace(secret, "[REDACTED]")
    for row in db.scalars(select(ForensicTerminalLog)):
        for secret in secret_values or []:
            if secret and row.command_history:
                row.command_history = row.command_history.replace(secret, "[REDACTED]")
    db.flush()


def _records(columns: tuple[str, ...], rows: list[tuple]) -> list[dict[str, Any]]:
    return [dict(zip(columns, row)) for row in rows]


def _seed_forensic_data(db: Session) -> None:
    db.execute(insert(ForensicEmployee), _records(
        ("emp_id", "name", "role", "department", "clearance_level", "active_badge_id"),
        [
            ("EMP-1001", "Marcus Vance", "Lead Teller", "Retail Banking", 2, "BADGE-101"),
            ("EMP-1042", "Sarah Connor", "Vault Custodian", "Treasury Operations", 4, "BADGE-102"),
            ("EMP-2089", "David Chen", "Systems Architect", "Information Security", 4, "BADGE-203"),
            ("EMP-3310", "Rachel Hayes", "Compliance Auditor", "Internal Audit", 3, "BADGE-304"),
            ("EMP-4091", "Viktor Brandt", "Senior DBA", "Infrastructure", 5, "BADGE-991"),
            ("EMP-5120", "Elena Gomez", "Night Operations", "Facilities", 1, "BADGE-405"),
            ("EMP-6004", "Thomas Becker", "Network Engineer", "IT Infrastructure", 3, "BADGE-506"),
        ],
    ))
    db.execute(insert(ForensicTransaction), _records(
        ("txn_id", "timestamp", "sender_account", "recipient_account", "amount", "currency", "terminal_id", "status", "memo"),
        [
            ("TXN-100201", "2026-10-03 01:14:22", "ACC-SPAIN-01", "ACC-COMM-99", 15200.0, "EUR", "TERM-TL-01", "CLEARED", "Routine Merchant Settlement"),
            ("TXN-100202", "2026-10-03 01:45:10", "ACC-TREAS-04", "ACC-CENTRAL-01", 1250000.0, "EUR", "TERM-OPS-03", "CLEARED", "Reserve Rebalancing"),
            ("TXN-449102", "2026-10-03 02:11:05", "ACC-OFFSHORE-09", "ACC-CAYMAN-77", 980000.0, "USD", "TERM-INTL-02", "FLAGGED", "DECOY: Audit compliance flag raised"),
            ("TXN-884920", "2026-10-03 02:49:18", "VAULT-MAIN-RESERVE", "GHOST-ESCAPEE-CH90", 48500000.0, "EUR", "TERM-SEC-09", "UNAUTHORIZED", "TARGET: Core Heist wire siphon. Ledger purge record — forensic cross-reference required."),
            ("TXN-902188", "2026-10-03 03:02:44", "ACC-PAYROLL-01", "ACC-EMP-DIST", 345000.0, "EUR", "TERM-FIN-01", "CLEARED", "Scheduled Friday Payroll Batch"),
            ("TXN-950114", "2026-10-03 03:22:19", "ACC-MAINT-02", "ACC-HVAC-VEND", 8450.0, "EUR", "TERM-FAC-01", "CLEARED", "Facility Maintenance Invoice"),
        ],
    ))
    db.execute(insert(ForensicAccessCard), _records(
        ("badge_id", "emp_id", "door_location", "timestamp", "access_granted"),
        [
            ("BADGE-405", "EMP-5120", "West Lobby Entrance", "2026-10-03 00:55:00", True),
            ("BADGE-102", "EMP-1042", "Treasury Outer Vault", "2026-10-03 01:30:12", True),
            ("BADGE-304", "EMP-3310", "Auditor Archives", "2026-10-03 01:50:44", True),
            ("BADGE-991", "EMP-4091", "Perimeter Door 3", "2026-10-03 02:35:10", True),
            ("BADGE-991", "EMP-4091", "Core Server Room B-4", "2026-10-03 02:44:02", True),
            ("BADGE-102", "EMP-1042", "Core Server Room B-4", "2026-10-03 02:46:15", False),
            ("BADGE-991", "EMP-4091", "Emergency Fire Exit E-2", "2026-10-03 03:15:20", True),
        ],
    ))
    db.execute(insert(ForensicTerminalLog), _records(
        ("terminal_id", "emp_id", "login_time", "logout_time", "command_history", "ip_address"),
        [
            ("TERM-OPS-03", "EMP-1042", "2026-10-03 01:25:00", "2026-10-03 02:00:00", "audit_check; balance_verify --all;", "10.0.14.22"),
            ("TERM-INTL-02", "EMP-3310", "2026-10-03 02:05:00", "2026-10-03 02:20:00", "compliance_scan --threshold=500000; alert_flag TXN-449102;", "10.0.18.5"),
            ("TERM-SEC-09", "EMP-4091", "2026-10-03 02:45:11", "2026-10-03 03:12:00", "sudo su; psql -d vault_core -c 'UPDATE ledgers SET status=PURGED WHERE txn_id=TXN-884920'; echo 'KEY_DERIVATION: SHA256(TXN-884920:BADGE-991:48500000) -> [REDACTED]';", "10.0.99.14"),
            ("TERM-FIN-01", "EMP-1001", "2026-10-03 03:00:00", "2026-10-03 03:10:00", "payroll_execute --batch=2026-10-03;", "10.0.12.8"),
        ],
    ))
    db.execute(insert(ForensicSecurityEvent), _records(
        ("timestamp", "event_type", "location", "severity", "notes"),
        [
            ("2026-10-03 01:10:00", "SENSOR_HEARTBEAT", "Perimeter Fence", "INFO", "Routine diagnostic ping OK"),
            ("2026-10-03 02:11:06", "TRANSACTION_ANOMALY", "International Gateway", "MEDIUM", "Offshore wire flagged by AML engine: TXN-449102 (Resolved: False Positive Decoy)"),
            ("2026-10-03 02:44:05", "VAULT_DOOR_BREACH", "Core Server Room B-4", "CRITICAL", "High security partition unlocked during non-standard hours by BADGE-991"),
            ("2026-10-03 02:50:00", "LARGE_FUND_DRAIN", "VAULT-MAIN-RESERVE", "CRITICAL", "Immediate telemetry drain: 48,500,000 EUR routed to external node. Forensic trail unconfirmed."),
            ("2026-10-03 03:16:00", "FIRE_EXIT_TRIP", "Emergency Fire Exit E-2", "HIGH", "Physical exit bar depressed without active fire alarm. Intruder fled perimeter."),
        ],
    ))


def execute_sql(query: str) -> Tuple[bool, List[str], List[Dict[str, Any]], str]:
    """Run a bounded SELECT in a PostgreSQL read-only transaction."""
    clean_query = query.strip()
    statement = clean_query.removesuffix(";").strip()
    if ";" in statement or not statement.upper().startswith(("SELECT", "WITH", "EXPLAIN")):
        return False, [], [], "Only read-only forensic queries are allowed."

    # Team-written SQL must run as the restricted forensic_reader role, never as
    # the main (superuser) connection, which could read answers and auth data.
    query_engine = forensic_engine
    if query_engine is None:
        if settings.is_production:
            return False, [], [], "Forensic query console is not configured."
        logger.warning("FORENSIC_DATABASE_URL not set; running forensic SQL on the main connection (development only)")
        query_engine = engine

    try:
        with query_engine.connect() as connection:
            connection.exec_driver_sql("BEGIN TRANSACTION READ ONLY")
            connection.exec_driver_sql("SET LOCAL statement_timeout = '5000ms'")
            result = connection.exec_driver_sql(statement)
            columns = list(result.keys()) if result.returns_rows else []
            rows = [dict(row) for row in result.mappings().fetchmany(100)] if result.returns_rows else []
            connection.rollback()
            return True, columns, rows, ""
    except Exception as exc:
        # Show only the first line of the database error (no internals/stack).
        lines = str(getattr(exc, "orig", exc)).strip().splitlines()
        return False, [], [], (lines[0] if lines else "Query failed.")[:300]


def verify_money_trail(
    submission_key: str,
    correct_key: str,
    suspect_txn: str = "",
) -> Tuple[bool, str, Dict[str, Any]]:
    """Validate submitted deletion key against the server-authoritative correct key."""
    clean_key = submission_key.strip().upper()
    expected = (correct_key or "").strip().upper()
    if expected and clean_key == expected:
        return True, "Forensic correlation verified! Core ledger deletion key unlocked.", {
            "rogue_txn": _DEFAULT_ROGUE_TXN,
        }
    return False, "Invalid deletion key. Cross-reference the terminal audit logs with the unauthorized server room breach.", {}