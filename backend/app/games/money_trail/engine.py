"""
Erase the Money Trail - SQL / Pandas Forensics Challenge Engine
Challenge: Correlate transactions, employee badges, terminal sessions, and security events
to identify the illicit heist transfer and compute the authoritative Deletion Key.
"""
import hashlib
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Tuple

DB_PATH = Path(__file__).parent / "money_trail.db"

CORRECT_DELETION_KEY = "ERASE-7429"
ROGUE_TRANSACTION_ID = "TXN-884920"
ROGUE_EMPLOYEE_ID = "EMP-4091"
ROGUE_BADGE_ID = "BADGE-991"
ROGUE_TERMINAL = "TERM-SEC-09"


def init_money_trail_db() -> None:
    """Initialize and populate the SQLite forensics database with realistic records and decoys."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Transactions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS transactions (
        txn_id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        sender_account TEXT NOT NULL,
        recipient_account TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        terminal_id TEXT,
        status TEXT NOT NULL,
        memo TEXT
    );
    """)

    # 2. Employee Directory
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS employees (
        emp_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT NOT NULL,
        clearance_level INTEGER NOT NULL,
        active_badge_id TEXT NOT NULL
    );
    """)

    # 3. Access Card Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS access_cards (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        badge_id TEXT NOT NULL,
        emp_id TEXT NOT NULL,
        door_location TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        access_granted BOOLEAN NOT NULL
    );
    """)

    # 4. Terminal Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS terminal_logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        terminal_id TEXT NOT NULL,
        emp_id TEXT NOT NULL,
        login_time TEXT NOT NULL,
        logout_time TEXT,
        command_history TEXT,
        ip_address TEXT NOT NULL
    );
    """)

    # 5. Security Sensor Events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS security_events (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        location TEXT NOT NULL,
        severity TEXT NOT NULL,
        notes TEXT
    );
    """)

    # Seed initial data if empty
    cursor.execute("SELECT COUNT(*) FROM transactions")
    if cursor.fetchone()[0] == 0:
        _seed_forensic_data(cursor)
        conn.commit()

    conn.close()


def _seed_forensic_data(cursor: sqlite3.Cursor) -> None:
    employees = [
        ("EMP-1001", "Marcus Vance", "Lead Teller", "Retail Banking", 2, "BADGE-101"),
        ("EMP-1042", "Sarah Connor", "Vault Custodian", "Treasury Operations", 4, "BADGE-102"),
        ("EMP-2089", "David Chen", "Systems Architect", "Information Security", 4, "BADGE-203"),
        ("EMP-3310", "Rachel Hayes", "Compliance Auditor", "Internal Audit", 3, "BADGE-304"),
        ("EMP-4091", "Viktor Brandt", "Senior DBA", "Infrastructure", 5, "BADGE-991"),
        ("EMP-5120", "Elena Gomez", "Night Operations", "Facilities", 1, "BADGE-405"),
        ("EMP-6004", "Thomas Becker", "Network Engineer", "IT Infrastructure", 3, "BADGE-506"),
    ]
    cursor.executemany("INSERT INTO employees VALUES (?,?,?,?,?,?)", employees)

    transactions = [
        ("TXN-100201", "2026-10-03 01:14:22", "ACC-SPAIN-01", "ACC-COMM-99", 15200.0, "EUR", "TERM-TL-01", "CLEARED", "Routine Merchant Settlement"),
        ("TXN-100202", "2026-10-03 01:45:10", "ACC-TREAS-04", "ACC-CENTRAL-01", 1250000.0, "EUR", "TERM-OPS-03", "CLEARED", "Reserve Rebalancing"),
        ("TXN-449102", "2026-10-03 02:11:05", "ACC-OFFSHORE-09", "ACC-CAYMAN-77", 980000.0, "USD", "TERM-INTL-02", "FLAGGED", "DECOY: Audit compliance flag raised"),
        ("TXN-884920", "2026-10-03 02:49:18", "VAULT-MAIN-RESERVE", "GHOST-ESCAPEE-CH90", 48500000.0, "EUR", "TERM-SEC-09", "UNAUTHORIZED", "TARGET: Core Heist wire siphon. Authorization token ERASE-7429 required for ledger deletion."),
        ("TXN-902188", "2026-10-03 03:02:44", "ACC-PAYROLL-01", "ACC-EMP-DIST", 345000.0, "EUR", "TERM-FIN-01", "CLEARED", "Scheduled Friday Payroll Batch"),
        ("TXN-950114", "2026-10-03 03:22:19", "ACC-MAINT-02", "ACC-HVAC-VEND", 8450.0, "EUR", "TERM-FAC-01", "CLEARED", "Facility Maintenance Invoice"),
    ]
    cursor.executemany("INSERT INTO transactions VALUES (?,?,?,?,?,?,?,?,?)", transactions)

    access_logs = [
        ("BADGE-405", "EMP-5120", "West Lobby Entrance", "2026-10-03 00:55:00", 1),
        ("BADGE-102", "EMP-1042", "Treasury Outer Vault", "2026-10-03 01:30:12", 1),
        ("BADGE-304", "EMP-3310", "Auditor Archives", "2026-10-03 01:50:44", 1),
        ("BADGE-991", "EMP-4091", "Perimeter Door 3", "2026-10-03 02:35:10", 1),
        ("BADGE-991", "EMP-4091", "Core Server Room B-4", "2026-10-03 02:44:02", 1),
        ("BADGE-102", "EMP-1042", "Core Server Room B-4", "2026-10-03 02:46:15", 0),
        ("BADGE-991", "EMP-4091", "Emergency Fire Exit E-2", "2026-10-03 03:15:20", 1),
    ]
    cursor.executemany("INSERT INTO access_cards (badge_id, emp_id, door_location, timestamp, access_granted) VALUES (?,?,?,?,?)", access_logs)

    terminal_logs = [
        ("TERM-OPS-03", "EMP-1042", "2026-10-03 01:25:00", "2026-10-03 02:00:00", "audit_check; balance_verify --all;", "10.0.14.22"),
        ("TERM-INTL-02", "EMP-3310", "2026-10-03 02:05:00", "2026-10-03 02:20:00", "compliance_scan --threshold=500000; alert_flag TXN-449102;", "10.0.18.5"),
        ("TERM-SEC-09", "EMP-4091", "2026-10-03 02:45:11", "2026-10-03 03:12:00", "sudo su; psql -d vault_core -c 'UPDATE ledgers SET status=PURGED WHERE txn_id=TXN-884920'; echo 'KEY_DERIVATION: SHA256(TXN-884920:BADGE-991:48500000) -> ERASE-7429';", "10.0.99.14"),
        ("TERM-FIN-01", "EMP-1001", "2026-10-03 03:00:00", "2026-10-03 03:10:00", "payroll_execute --batch=2026-10-03;", "10.0.12.8"),
    ]
    cursor.executemany("INSERT INTO terminal_logs (terminal_id, emp_id, login_time, logout_time, command_history, ip_address) VALUES (?,?,?,?,?,?)", terminal_logs)

    security_events = [
        ("2026-10-03 01:10:00", "SENSOR_HEARTBEAT", "Perimeter Fence", "INFO", "Routine diagnostic ping OK"),
        ("2026-10-03 02:11:06", "TRANSACTION_ANOMALY", "International Gateway", "MEDIUM", "Offshore wire flagged by AML engine: TXN-449102 (Resolved: False Positive Decoy)"),
        ("2026-10-03 02:44:05", "VAULT_DOOR_BREACH", "Core Server Room B-4", "CRITICAL", "High security partition unlocked during non-standard hours by BADGE-991"),
        ("2026-10-03 02:50:00", "LARGE_FUND_DRAIN", "VAULT-MAIN-RESERVE", "CRITICAL", "Immediate telemetry drain: 48,500,000 EUR routed to external node. Forensic trail unconfirmed."),
        ("2026-10-03 03:16:00", "FIRE_EXIT_TRIP", "Emergency Fire Exit E-2", "HIGH", "Physical exit bar depressed without active fire alarm. Intruder fled perimeter."),
    ]
    cursor.executemany("INSERT INTO security_events (timestamp, event_type, location, severity, notes) VALUES (?,?,?,?,?)", security_events)


def execute_sql(query: str) -> Tuple[bool, List[str], List[Dict[str, Any]], str]:
    """
    Execute read-only SQL query against the money trail forensics database.
    Returns (success, column_names, rows, error_message).
    """
    clean_query = query.strip()
    upper = clean_query.upper()

    # Security check: Read-only queries only
    disallowed = ["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "ATTACH", "DETACH", "PRAGMA"]
    for keyword in disallowed:
        if keyword in upper.split():
            return False, [], [], f"Security Violation: '{keyword}' is prohibited. Only read-only forensic SELECT queries are allowed."

    if not upper.startswith("SELECT") and not upper.startswith("WITH") and not upper.startswith("EXPLAIN"):
        return False, [], [], "Only SELECT queries can be executed in the forensic environment."

    if not DB_PATH.exists():
        init_money_trail_db()

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(clean_query)
        rows_raw = cursor.fetchmany(100) # limit to 100 rows
        columns = [d[0] for d in cursor.description] if cursor.description else []
        results = [dict(row) for row in rows_raw]
        conn.close()
        return True, columns, results, ""
    except Exception as e:
        return False, [], [], str(e)


def verify_money_trail(submission_key: str, suspect_txn: str = "") -> Tuple[bool, str, Dict[str, Any]]:
    """Validate submitted deletion key and optional transaction ID."""
    clean_key = submission_key.strip().upper()
    if clean_key == CORRECT_DELETION_KEY:
        return True, "Forensic correlation verified! Core ledger deletion key unlocked.", {
            "deletion_key": CORRECT_DELETION_KEY,
            "rogue_txn": ROGUE_TRANSACTION_ID,
            "rogue_employee": ROGUE_EMPLOYEE_ID,
            "rogue_badge": ROGUE_BADGE_ID,
            "rogue_terminal": ROGUE_TERMINAL,
        }
    return False, "Invalid deletion key. Cross-reference the terminal audit logs with the unauthorized server room breach.", {}
