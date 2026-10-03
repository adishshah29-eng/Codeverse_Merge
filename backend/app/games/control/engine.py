"""
Stage 2: Find the Control Server (CTF Engine)
Preserves the exact 3 security sector puzzles from P2_G2 (IronVault CTF):
1. Teller Portal Login (SQL Injection) -> IVB-LEVEL1-7Q2
2. Institutional Transfers (DOM Manipulation) -> IVB-LEVEL2-5K8
3. Vault Balance Audit (HTTP Response Headers) -> IVB-LEVEL3-3M9
Final Output: Control Token (MINT-OMEGA)
"""
import re
import uuid
from typing import Any, Dict, Tuple

PUZZLE_CODES = {
    1: "IVB-LEVEL1-7Q2",
    2: "IVB-LEVEL2-5K8",
    3: "IVB-LEVEL3-3M9",
}

CONTROL_SERVER_TOKEN = "MINT-OMEGA"
DECOY_BODY_CODE = "FAKE-000-DECOY"


def evaluate_teller_login(username: str, password: str) -> Tuple[bool, str, str, bool, str]:
    """
    Evaluates SQL injection attempt on teller login.
    Returns (success, simulated_query, auth_code, was_filtered, message).
    """
    filter_regex = re.compile(r"(--|;|\/\*)")
    was_filtered = bool(filter_regex.search(username) or filter_regex.search(password))
    filtered_user = filter_regex.sub("", username)
    filtered_pass = filter_regex.sub("", password)

    simulated_query = f"SELECT * FROM tellers WHERE user='{filtered_user}' AND pass='{filtered_pass}'"
    combined = f"{filtered_user} {filtered_pass}".upper()

    # Decoy trap: ' OR '2'='2
    if re.search(r"'\s*OR\s*'?2'?\s*=\s*'?2'?", combined):
        return False, simulated_query, "", was_filtered, "Login failed: Teller records matched decoy trap. Authorization denied."

    # Valid tautology: ' OR '1'='1 or 1=1
    is_tautology = bool(
        re.search(r"'\s*OR\s*'?1'?\s*=\s*'?1'?", combined)
        or re.search(r"'\s*OR\s*'?[A-Z]'?\s*=\s*'?[A-Z]'?", combined)
        or re.search(r"\b1\s*=\s*1\b", combined)
    )

    if is_tautology:
        return True, simulated_query, PUZZLE_CODES[1], was_filtered, "SQL Injection Successful! Bypass accepted."

    return False, simulated_query, "", was_filtered, "Login failed: Invalid credentials. Check debug console."


def evaluate_code_submission(puzzle_id: int, code: str) -> Tuple[bool, str, bool]:
    """
    Validates submitted code for a sector.
    Returns (success, message, trap_triggered).
    """
    if puzzle_id not in PUZZLE_CODES:
        return False, "Invalid sector ID", False

    clean_code = code.strip().upper()
    target_code = PUZZLE_CODES[puzzle_id]

    # Check decoy body code for Sector 3
    if puzzle_id == 3 and clean_code == DECOY_BODY_CODE:
        return False, "Decoy detected! The audit code is NOT in the JSON response body. Inspect HTTP headers.", True

    # Check request ID decoy
    if puzzle_id == 3 and (re.match(r"^[0-9A-F]{8}-[0-9A-F]{4}", clean_code) or clean_code.startswith("REQ-")):
        return False, "That is an X-Request-Id header, not the audit code. Look for X-Audit-Code.", True

    if clean_code == target_code:
        return True, f"Sector 0{puzzle_id} breached successfully! Access granted.", False

    return False, "Incorrect access code. Review the puzzle instructions and try again.", False
