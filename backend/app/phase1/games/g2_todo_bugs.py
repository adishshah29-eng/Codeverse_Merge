"""Stage 2 — FastAPI TODO repo: bust the bugs.

Teams submit the files they changed under ``app/`` plus a one-line root-cause note per bug. We overlay those files
on the pristine handout (the original tests are always used), run pytest in the sandbox and score per bug.
"""
import difflib
import json
from typing import Any, Dict

from app.phase1.games.common import (
    check, clean_python_files, run_failure, keyword_hits, problem_dir, read_text, result, run_with_marker,
)

PROBLEM = "p2_todo_bugs"
TIMEOUT = 60

# bug tier -> tests that expose it; every other test is a regression guard
BUGS = {
    "easy": {"tests": ["test_create_returns_201_and_body"], "label": "Easy — wrong HTTP status"},
    "medium": {"tests": ["test_pagination_visits_every_todo_exactly_once", "test_pagination_page_boundaries"],
               "label": "Medium — pagination off-by-one"},
    "hard": {"tests": ["test_complete_is_persisted_across_requests"], "label": "Hard — silent data bug under the ORM"},
}

# A root-cause note is credited when it clearly names the mechanism (at least `need` of the regexes match).
NOTE_PATTERNS = {
    "easy": (1, [r"201|created", r"status|code|decorator|default|200"]),
    "medium": (1, [r"off[- ]by[- ]one|offset|skip\s*-\s*1|boundar|subtract|duplicat|overlap|start\b"]),
    "hard": (2, [r"commit", r"flush|rollback|roll back|transaction|session|persist|never saved|not saved|database|\bdb\b"]),
}

META = {
    "id": 2,
    "title": "FastAPI TODO repo — bust the bugs",
    "domain": "Debugging",
    "difficulty": "Easy → Hard (3 bugs)",
    "handout": PROBLEM,
    "brief": (
        "You're given a complete, runnable FastAPI TODO-list app (SQLite via SQLAlchemy) and its test suite. It starts "
        "up and mostly works — but three bugs are planted, one per difficulty tier.\n\n"
        "Unzip the handout, `pip install -r requirements.txt`, run `pytest` and watch some tests fail. Find and fix the "
        "bugs so every test passes, with minimal, correct changes. Do NOT edit, delete or skip tests.\n\n"
        "For each fix write a one-line root-cause note — why it was wrong, not just what you changed.\n\n"
        "Submit the files you changed under app/ (add each file below with its path, e.g. app/crud.py) and one note "
        "per bug. Scoring: 1 point per bug fixed + 1 per correct root-cause note (6 total, scaled to 10)."
    ),
    "submit": {
        "files": {"mode": "multi", "prefix": "app/", "names": ["app/main.py", "app/crud.py"]},
        "fields": [
            {"key": "easy", "label": "Root cause — easy bug", "multiline": False, "required": False},
            {"key": "medium", "label": "Root cause — medium bug", "multiline": False, "required": False},
            {"key": "hard", "label": "Root cause — hard bug", "multiline": False, "required": False},
        ],
    },
    "hints": [
        "Four tests are red on arrival: read each failing assertion — one is a status code, two are about the same endpoint's paging, one only fails when a *later* request reads the data.",
        "For the paging bug, walk the pages by hand with skip=0, limit=4 then skip=4, limit=4 and compare the ids — what does skip actually mean?",
        "For the silent bug: the response says completed=true, yet the next request disagrees. Ask what ends the transaction when get_db closes the session.",
    ],
}

RUNNER = r'''
import contextlib, io, json, os, sys, traceback

def _main():
    marker = "__RES_@@NONCE@@__:"
    out = {"tests": {}, "error": None, "collected": 0}
    sys.path.insert(0, os.getcwd())
    try:
        import pytest

        class Collect:
            def pytest_runtest_logreport(self, report):
                name = report.nodeid.split("::")[-1]
                if report.when == "call":
                    out["tests"][name] = report.passed
                elif report.when in ("setup", "teardown") and report.failed:
                    out["tests"][name] = False

        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            rc = pytest.main(["-q", "-p", "no:cacheprovider", "tests"], plugins=[Collect()])
        out["collected"] = len(out["tests"])
        out["rc"] = int(rc)
    except BaseException:
        out["error"] = traceback.format_exc()[-1500:]
    print("\n" + marker + json.dumps(out))

_main()
'''


def _pristine_files() -> Dict[str, str]:
    root = problem_dir(PROBLEM) / "handout"
    files: Dict[str, str] = {}
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        if path.is_file() and "__pycache__" not in relative and ".pytest_cache" not in relative and relative.endswith((".py", ".ini", ".txt")):
            files[relative] = read_text(path)
    return files


def _changed_lines(submitted: Dict[str, str], pristine: Dict[str, str]) -> int:
    total = 0
    for path, text in submitted.items():
        before = pristine.get(path, "").splitlines()
        for line in difflib.unified_diff(before, text.splitlines(), lineterm="", n=0):
            if line.startswith(("+", "-")) and not line.startswith(("+++", "---")):
                total += 1
    return total


def grade(files: Dict[str, str], answers: Dict[str, str]) -> Dict[str, Any]:
    try:
        overlay = clean_python_files(files, allowed_prefix="app/")
    except ValueError as exc:
        return result([], str(exc), valid=False)
    if not overlay:
        return result([], "Submit at least one changed file under app/ (for example app/crud.py).", valid=False)

    pristine = _pristine_files()
    sandbox_files = dict(pristine)
    sandbox_files.update(overlay)          # tests/, pytest.ini always come from the pristine handout
    run, payload = run_with_marker(_runner(), sandbox_files, TIMEOUT)
    if payload is None:
        return run_failure(run, TIMEOUT)
    if payload.get("error") or not payload["tests"]:
        return result([], "Your app could not be imported or tested (syntax error / broken import?):\n"
                          + (payload.get("error") or "no tests ran"), valid=False)

    outcome: Dict[str, bool] = payload["tests"]
    expected = {name for bug in BUGS.values() for name in bug["tests"]}
    guards = sorted(name for name in outcome if name not in expected)
    all_tests = set(pristine_tests())
    missing = sorted(all_tests - set(outcome))          # a test that vanished counts as failed
    regressions = [name for name in guards if not outcome[name]] + missing

    checks = []
    fixed = {}
    for tier, bug in BUGS.items():
        ok = all(outcome.get(name, False) for name in bug["tests"])
        fixed[tier] = ok
        checks.append(check(f"Fix — {bug['label']}", ok, 10 / 6, 10 / 6,
                            "its tests are green" if ok else "its tests are still red: " + ", ".join(
                                n for n in bug["tests"] if not outcome.get(n, False))))
    for tier in BUGS:
        need, patterns = NOTE_PATTERNS[tier]
        note = (answers.get(tier) or "").strip()
        credited = fixed[tier] and len(note) >= 15 and keyword_hits(note, patterns) >= need
        if not fixed[tier]:
            why = "needs its bug fixed first"
        elif not note:
            why = "no note written"
        else:
            why = "note names the root cause" if credited else "note doesn't explain the mechanism — say WHY it was wrong"
        checks.append(check(f"Root cause — {tier}", credited, 10 / 6, 10 / 6, why))

    penalty = min(3.0, 1.0 * len(regressions))
    if regressions:
        checks.append({"name": "Regressions", "passed": False, "points": -penalty, "max": 0.0,
                       "note": "previously-green tests now fail: " + ", ".join(regressions)})
    score = sum(c["points"] for c in checks)
    changed = _changed_lines(overlay, {k: v for k, v in pristine.items()})
    green = all(outcome.values()) and not missing
    message = ("All tests green — nicely done." if green else
               f"{sum(1 for ok in outcome.values() if ok)}/{len(all_tests)} tests pass.")
    if green and changed > 40:
        message += f" (Heads-up: {changed} changed lines — minimal fixes score best; organizers may review.)"
    return result(checks, message, perfect_at=9.9, score=score,
                  details={"tests": outcome, "changed_lines": changed, "notes": {t: answers.get(t, "") for t in BUGS}})


def pristine_tests() -> list:
    names = []
    for path in (problem_dir(PROBLEM) / "handout" / "tests").glob("test_*.py"):
        for line in read_text(path).splitlines():
            line = line.strip()
            if line.startswith("def test_"):
                names.append(line[4:line.index("(")])
    return names


def _runner() -> str:
    return RUNNER
