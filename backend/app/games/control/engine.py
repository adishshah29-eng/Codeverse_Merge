"""
Stage 2: Find the Control Server (CTF Engine)
Preserves the exact 3 security sector puzzles from P2_G2 (IronVault CTF):
1. Teller Portal Login (SQL Injection)
2. Institutional Transfers (DOM Manipulation)
3. Vault Balance Audit (HTTP Response Headers)
Final Output: Control Token

SECURITY: All secret codes are loaded from ConfigKV at request time via the router.
          This file contains NO hardcoded puzzle answers.
"""
import re
from typing import Tuple


def evaluate_teller_login(username: str, password: str) -> Tuple[bool, str, str, bool, str]:
    """
    Evaluates SQL injection attempt on teller login.
    Returns (success, simulated_query, auth_code, was_filtered, message).
    auth_code is only populated when success=True; caller injects the code from ConfigKV.
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
        return True, simulated_query, "__inject_from_config__", was_filtered, "SQL Injection Successful! Bypass accepted."

    return False, simulated_query, "", was_filtered, "Login failed: Invalid credentials. Check debug console."


def evaluate_code_submission(puzzle_id: int, code: str, puzzle_codes: dict, decoy_body_code: str) -> Tuple[bool, str, bool]:
    """
    Validates submitted code for a sector.
    Returns (success, message, trap_triggered).
    puzzle_codes: dict mapping puzzle_id -> correct_code (from ConfigKV, not hardcoded here)
    """
    if puzzle_id not in puzzle_codes:
        return False, "Invalid sector ID", False

    clean_code = code.strip().upper()
    target_code = puzzle_codes[puzzle_id]
    if not target_code:
        return False, "This sector is not configured for code submission.", False

    # Check decoy body code for Sector 3
    if puzzle_id == 3 and clean_code == decoy_body_code:
        return False, "Decoy detected! The audit code is NOT in the JSON response body. Inspect HTTP headers.", True

    # Check request ID decoy
    if puzzle_id == 3 and (re.match(r"^[0-9A-F]{8}-[0-9A-F]{4}", clean_code) or clean_code.startswith("REQ-")):
        return False, "That is an X-Request-Id header, not the audit code. Look for X-Audit-Code.", True

    if clean_code == target_code:
        return True, f"Sector 0{puzzle_id} breached successfully! Access granted.", False

    return False, "Incorrect access code. Review the puzzle instructions and try again.", False
