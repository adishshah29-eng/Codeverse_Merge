"""Stage 3 — CTF: pull the password out of the binary.

Teams download ``stage1`` (and the bonus ``stage1_xor``), recover the password statically or dynamically, and
submit it with the flag and a note on the technique. Binaries are built by ``competition/p3_ctf/organizer/build.sh``;
if you rebuild with a different password/flag set PHASE1_CTF_PASSWORD / PHASE1_CTF_FLAG (and *_XOR variants).
"""
import hmac
import os
from typing import Any, Dict

from app.phase1.games.common import check, keyword_hits, result

PROBLEM = "p3_ctf"

CTF_PASSWORD = os.environ.get("PHASE1_CTF_PASSWORD", "r3v3rs3_m3_pls")
CTF_FLAG = os.environ.get("PHASE1_CTF_FLAG", "flag{stage1_cleared_on_to_the_next}")
CTF_XOR_PASSWORD = os.environ.get("PHASE1_CTF_XOR_PASSWORD", CTF_PASSWORD)
CTF_XOR_FLAG = os.environ.get("PHASE1_CTF_XOR_FLAG", CTF_FLAG)

TECHNIQUE = [r"strings|ltrace|ghidra|objdump|disassembl|gdb|radare|r2\b|ida\b|strcmp|breakpoint|xor|decompil|static|dynamic"]

META = {
    "id": 3,
    "title": "CTF — pull the password out of the binary",
    "domain": "Security / reverse engineering",
    "difficulty": "Medium",
    "handout": PROBLEM,
    "brief": (
        "You're given ./stage1 (Linux x86-64). Run it and it asks for a password; wrong input prints \"Access denied\". "
        "The correct password is hidden inside the binary. Recover it — statically or dynamically — and use it to "
        "reveal the flag. Brute-forcing the input is not allowed (and won't be fast enough anyway).\n\n"
        "A second binary, stage1_xor, is the BONUS: it is stripped and obfuscated, so plain `strings` won't help — "
        "use a disassembler or a debugger breakpoint.\n\n"
        "Only run these on a machine you own (WSL, a Linux VM or Docker are fine). Tools worth knowing: strings, "
        "ltrace, objdump -d, Ghidra, gdb.\n\n"
        "Submit the password, the flag, and a short note on which technique you used and why it works. "
        "Scoring (10): password 3 + flag 4 · method note 1 · bonus stage1_xor password 1 + flag 1. "
        "Wrong answers cost a small penalty — don't guess."
    ),
    "submit": {
        "files": {"mode": "none"},
        "fields": [
            {"key": "password", "label": "stage1 password", "multiline": False, "required": True},
            {"key": "flag", "label": "stage1 flag  (flag{...})", "multiline": False, "required": True},
            {"key": "note", "label": "Method note — which technique, and why it works", "multiline": True, "required": False},
            {"key": "bonus_password", "label": "BONUS: stage1_xor password", "multiline": False, "required": False},
            {"key": "bonus_flag", "label": "BONUS: stage1_xor flag", "multiline": False, "required": False},
        ],
    },
    "hints": [
        "Try the cheapest tool first: strings on the binary, then ltrace while you type a wrong password and watch which libc calls are made.",
        "The program compares your input with the real password using a standard C library function. ltrace prints both arguments of that call.",
        "For stage1_xor nothing readable is stored. The password is decoded at runtime — but it still has to be handed to the same compare function, so break there in gdb (b strcmp) and print the other argument.",
    ],
}


def _same(given: str, expected: str) -> bool:
    return hmac.compare_digest((given or "").strip().encode(), expected.encode())


def grade(files: Dict[str, str], answers: Dict[str, str]) -> Dict[str, Any]:
    password, flag = (answers.get("password") or "").strip(), (answers.get("flag") or "").strip()
    b_password, b_flag = (answers.get("bonus_password") or "").strip(), (answers.get("bonus_flag") or "").strip()
    note = (answers.get("note") or "").strip()
    if not any((password, flag, b_password, b_flag)):
        return result([], "Enter the password and the flag.", valid=False)

    pw_ok, flag_ok = _same(password, CTF_PASSWORD), _same(flag, CTF_FLAG)
    bpw_ok, bflag_ok = _same(b_password, CTF_XOR_PASSWORD), _same(b_flag, CTF_XOR_FLAG)
    wrong = [label for label, given, ok in (
        ("password", password, pw_ok), ("flag", flag, flag_ok),
        ("bonus password", b_password, bpw_ok), ("bonus flag", b_flag, bflag_ok)) if given and not ok]

    technique = len(note) >= 30 and keyword_hits(note, TECHNIQUE) >= 1
    main_done = pw_ok and flag_ok
    checks = [
        check("stage1 password", pw_ok, 3, 3, "correct" if pw_ok else ("incorrect" if password else "not submitted")),
        check("stage1 flag", flag_ok, 4, 4, "correct" if flag_ok else ("incorrect" if flag else "not submitted")),
        check("Method note", technique and main_done, 1, 1,
              "technique explained" if technique and main_done else "explain the tool/technique you used (≥ 30 chars) once the main flag is solved"),
        check("Bonus — stage1_xor password", bpw_ok, 1, 1, "correct" if bpw_ok else ("incorrect" if b_password else "optional")),
        check("Bonus — stage1_xor flag", bflag_ok, 1, 1, "correct" if bflag_ok else ("incorrect" if b_flag else "optional")),
    ]
    if wrong:
        message = "Incorrect: " + ", ".join(wrong) + ". Access denied."
    elif main_done:
        message = "ACCESS GRANTED — stage1 cleared!" + (" Bonus variant solved too." if bpw_ok and bflag_ok else
                                                         " You can still submit the stage1_xor bonus, or lock in your score and continue.")
    else:
        message = "Partial answer recorded."
    return result(checks, message, valid=not wrong, perfect_at=9.9)
