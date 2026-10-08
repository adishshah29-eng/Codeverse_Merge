"""Shared helpers for the five Phase 1 challenges.

Every challenge is graded by a function ``grade(files, answers) -> dict`` returning::

    {
      "score": float,        # raw score 0..10 for this submission (before hint / wrong-attempt deductions)
      "perfect": bool,       # True when nothing more can be earned -> the stage completes automatically
      "valid": bool,         # False = the attempt itself was unusable (counts as a wrong attempt)
      "message": str,
      "checks": [ {"name", "passed", "points", "max", "note"} ... ],
      "details": {...}       # optional extra info shown to the team / stored for organizers
    }

The handouts, hidden test data and answer keys live in ``competition/<problem>/`` at the
repository root (``handout/`` is given to teams, ``organizer/`` never leaves the server).
"""
from __future__ import annotations

import io
import json
import re
import secrets
import stat
import zipfile
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from app.phase1.games.sandbox import RunResult, run_python
from app.settings import ROOT

COMPETITION_DIR = ROOT / "competition"

_SKIP_PARTS = {"__pycache__", ".pytest_cache", ".git", ".DS_Store"}
_EXECUTABLE = {"stage1", "stage1_xor"}


def problem_dir(name: str) -> Path:
    return COMPETITION_DIR / name


def check(name: str, passed: bool, points: float, max_points: float, note: str = "") -> Dict[str, Any]:
    return {
        "name": name,
        "passed": bool(passed),
        "points": round(float(points), 2) if passed else 0.0,
        "max": float(max_points),
        "note": note,
    }


def result(checks: List[Dict[str, Any]], message: str, *, valid: bool = True,
           perfect_at: float = 9.0, details: Optional[Dict[str, Any]] = None,
           score: Optional[float] = None) -> Dict[str, Any]:
    total = sum(c["points"] for c in checks) if score is None else score
    total = max(0.0, min(10.0, round(total, 2)))
    return {
        "score": total,
        "perfect": valid and total >= perfect_at,
        "valid": valid,
        "message": message,
        "checks": checks,
        "details": details or {},
    }


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def keyword_hits(text: str, groups: Iterable[str]) -> int:
    """How many of the regex `groups` match somewhere in `text` (case-insensitive)."""
    return sum(1 for pattern in groups if re.search(pattern, text or "", re.IGNORECASE))


# ── handouts ───────────────────────────────────────────────────────────────────

@lru_cache(maxsize=16)
def handout_zip(name: str) -> bytes:
    """The team-facing download for a problem: everything in ``competition/<name>/handout``."""
    root = problem_dir(name) / "handout"
    if not root.is_dir():
        raise FileNotFoundError(f"Handout for {name} is missing.")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(root.rglob("*")):
            relative = path.relative_to(root)
            if path.is_dir() or any(part in _SKIP_PARTS for part in relative.parts):
                continue
            info = zipfile.ZipInfo(f"{name}/{relative.as_posix()}", date_time=(2026, 10, 8, 0, 0, 0))
            mode = 0o755 if path.name in _EXECUTABLE else 0o644
            info.external_attr = (stat.S_IFREG | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    return buffer.getvalue()


# ── sandboxed runs ─────────────────────────────────────────────────────────────

def run_with_marker(runner: str, files: Dict[str, str], timeout: int,
                    data_files: Iterable[Path] = ()) -> tuple[RunResult, Optional[Dict[str, Any]]]:
    """Run `runner` (source of main.py) in the sandbox and parse its marked JSON result.

    The literal ``@@NONCE@@`` in the runner is replaced with a fresh random token; the runner
    prints ``<token>:<json>`` as its last act. Ordinary output from team code can therefore
    never be mistaken for the result. The *last* marker line wins.
    """
    nonce = secrets.token_hex(16)
    marker = f"__RES_{nonce}__:"
    run = run_python(runner.replace("@@NONCE@@", nonce), timeout, data_files=data_files, extra_files=files)
    payload = None
    for line in run.stdout.splitlines():
        if line.startswith(marker):
            try:
                payload = json.loads(line[len(marker):])
            except ValueError:
                payload = None
    return run, payload


def failure_message(run: RunResult, timeout: int) -> str:
    if run.busy:
        return run.stderr
    if run.timed_out:
        return f"Your code did not finish within the {timeout}s limit (infinite loop or far too slow?)."
    tail = (run.stderr or run.stdout or "").strip().splitlines()[-6:]
    return "Your submission could not be graded: " + (" | ".join(tail) if tail else "no output.")


def run_failure(run: RunResult, timeout: int) -> Dict[str, Any]:
    """Result for a run that produced no grade. Busy / unavailable sandboxes are the server's problem, not the
    team's: they are flagged ``retry`` so the attempt is not recorded or counted against the team."""
    infrastructure = run.busy or "sandbox is unavailable" in (run.stderr or "")
    out = result([], failure_message(run, timeout), valid=False)
    out["retry"] = infrastructure
    return out


def clean_python_files(files: Dict[str, str], *, allowed_prefix: str = "", allowed_names: Iterable[str] = (),
                       max_files: int = 20) -> Dict[str, str]:
    """Keep only well-formed, allowed `.py` paths from a submission (never tests, never `..`)."""
    allowed = set(allowed_names)
    cleaned: Dict[str, str] = {}
    for raw_path, content in files.items():
        path = raw_path.replace("\\", "/").lstrip("./")
        if ".." in path.split("/") or not path.endswith(".py"):
            continue
        if path in allowed or (allowed_prefix and path.startswith(allowed_prefix) and re.fullmatch(r"[\w./-]+", path)):
            cleaned[path] = content
    if len(cleaned) > max_files:
        raise ValueError(f"Too many files (max {max_files}).")
    return cleaned
