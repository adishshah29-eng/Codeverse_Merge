"""Stage 1 — URL shortener: make the slow one fast.

Teams submit their optimised ``shortener.py``. In the sandbox we run the handout's behaviour tests
(correctness gate) and then the load test; the speedup is measured against the unmodified baseline.
"""
import json
import math
import os
import re
import threading
from typing import Any, Dict, Optional

from app.phase1.games.common import (
    check, clean_python_files, failure_message, keyword_hits, problem_dir, read_text, result, run_failure, run_with_marker,
)

PROBLEM = "p1_url_shortener"
LOAD_N = int(os.environ.get("PHASE1_URL_LOAD_N", "2000"))   # shortens + redirects in the load test
TARGET_SPEEDUP = 20.0
TIMEOUT = 60

META = {
    "id": 1,
    "title": "URL Shortener — make the slow one fast",
    "domain": "Systems / optimization",
    "difficulty": "Easy–Medium",
    "handout": PROBLEM,
    "brief": (
        "You're given a working URL shortener with two endpoints:\n"
        "  • POST /shorten with {\"url\": \"https://...\"} → returns a short code\n"
        "  • GET /{code} → redirects (301) to the original URL\n\n"
        "It works. It's also slow. Profile it, fix the bottlenecks, and make it fast WITHOUT changing the API "
        "or breaking any existing behaviour.\n\n"
        "Rules: same endpoints, status codes and JSON; duplicate URLs still return the same code; keep the "
        "function names shorten/resolve, the ShortenRequest model and reset() (add reset_cache() if you add a "
        "cache). Standard library + FastAPI only.\n\n"
        "Scoring (10): correctness gate 2 · speedup vs. baseline up to 6 (full marks at 20×) · read-path cache 1 · "
        "a short note naming each bottleneck you fixed 1."
    ),
    "submit": {
        "files": {"mode": "single", "names": ["shortener.py"]},
        "fields": [
            {"key": "note", "label": "Bottlenecks you found and fixed (one line each)", "multiline": True, "required": False},
        ],
    },
    "hints": [
        "Run the load test with a profiler (python -m cProfile -s cumtime loadtest.py 500) — the time is not where you'd guess.",
        "Three separate things scale with the number of stored URLs on every request: reading the file, scanning for duplicates, and scanning for a free code.",
        "Keep the store in memory (a dict code→url plus a reverse dict url→code) and write through to disk without re-reading it.",
    ],
}

RUNNER = r'''
import contextlib, io, json, os, sys, tempfile, time, traceback

def _main():
    marker = "__RES_@@NONCE@@__:"
    out = {"gate": False, "passed": 0, "failed": [], "load": None, "error": None}
    sys.path.insert(0, os.getcwd())
    os.environ["SHORTENER_STORE"] = os.path.join(tempfile.mkdtemp(), "store.json")
    try:
        import pytest

        class Collect:
            def __init__(self):
                self.passed, self.failed = 0, []
            def pytest_runtest_logreport(self, report):
                if report.when == "call" or (report.when == "setup" and report.failed):
                    if report.passed:
                        self.passed += 1
                    else:
                        self.failed.append(report.nodeid.split("::")[-1])

        col = Collect()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            pytest.main(["-q", "-p", "no:cacheprovider", "test_correctness.py"], plugins=[col])
        out["passed"], out["failed"] = col.passed, col.failed
        out["gate"] = col.passed >= 7 and not col.failed
        if out["gate"]:
            import loadtest
            out["load"] = loadtest.run(@@N@@)
    except BaseException:
        out["error"] = traceback.format_exc()[-1500:]
    print("\n" + marker + json.dumps(out))

_main()
'''

_baseline_lock = threading.Lock()
_baseline_seconds: Optional[float] = None


def _runner() -> str:
    return RUNNER.replace("@@N@@", str(LOAD_N))


def _handout_files(shortener_source: str) -> Dict[str, str]:
    handout = problem_dir(PROBLEM) / "handout"
    return {
        "shortener.py": shortener_source,
        "test_correctness.py": read_text(handout / "test_correctness.py"),
        "loadtest.py": read_text(handout / "loadtest.py"),
    }


def baseline_seconds() -> float:
    """Total load-test time of the untouched handout on this server (measured once per process)."""
    global _baseline_seconds
    override = os.environ.get("PHASE1_URL_BASELINE_SECONDS")
    if override:
        return float(override)
    with _baseline_lock:
        if _baseline_seconds is None:
            source = read_text(problem_dir(PROBLEM) / "handout" / "shortener.py")
            run, payload = run_with_marker(_runner(), _handout_files(source), timeout=300)
            if not payload or not payload.get("load"):
                raise RuntimeError("Could not measure the URL shortener baseline: " + failure_message(run, 300))
            _baseline_seconds = float(payload["load"]["total_seconds"])
    return _baseline_seconds


def grade(files: Dict[str, str], answers: Dict[str, str]) -> Dict[str, Any]:
    source = (files.get("shortener.py") or "").strip()
    if not source:
        return result([], "Submit your shortener.py.", valid=False)
    try:
        cleaned = clean_python_files(files, allowed_names=["shortener.py"])
    except ValueError as exc:
        return result([], str(exc), valid=False)
    if "shortener.py" not in cleaned:
        return result([], "Submit your shortener.py.", valid=False)

    baseline = baseline_seconds()
    run, payload = run_with_marker(_runner(), _handout_files(cleaned["shortener.py"]), TIMEOUT)
    if payload is None:
        return run_failure(run, TIMEOUT)
    if payload.get("error"):
        return result([], "Your shortener crashed while being tested:\n" + payload["error"], valid=False)

    checks = []
    gate = bool(payload["gate"])
    if not gate:
        failed = ", ".join(payload.get("failed") or []) or "see your own test run"
        checks.append(check("Correctness gate", False, 2, 2, f"{payload['passed']}/7 behaviour tests pass. Failing: {failed}"))
        return result(checks, "Behaviour changed — the correctness gate failed, so nothing is scored. "
                              "Fix the failing tests and resubmit.", valid=False)
    checks.append(check("Correctness gate", True, 2, 2, "All 7 behaviour tests pass"))

    load = payload["load"]
    total = max(float(load["total_seconds"]), 0.004)
    speedup = baseline / total
    speed_points = 6.0 * min(1.0, max(0.0, math.log(max(speedup, 1.0)) / math.log(TARGET_SPEEDUP)))
    checks.append(check(
        f"Speedup vs baseline (target {TARGET_SPEEDUP:.0f}×)", speedup > 1.05, speed_points, 6,
        f"{speedup:.1f}× faster ({total:.3f}s vs {baseline:.2f}s for {LOAD_N} shortens + {LOAD_N} redirects)",
    ))

    cached = bool(re.search(r"lru_cache|OrderedDict|cachetools|\bLRU\b", cleaned["shortener.py"], re.I))
    checks.append(check("Read-path cache (bonus)", cached, 1, 1, "LRU / cache on the redirect path" if cached else "no LRU cache found"))

    note = answers.get("note", "")
    groups = [r"linear|scan|O\(n\)|reverse|loop", r"file|disk|json|re-?read|parse|in[- ]memory|memory",
              r"collision|random|retry|set\b|index|membership", r"cache|lru"]
    hits = keyword_hits(note, groups)
    checks.append(check("Bottleneck note (bonus)", hits >= 3, 1, 1, f"{hits}/4 bottlenecks mentioned (need 3)"))

    message = f"Speedup {speedup:.1f}× — behaviour preserved."
    return result(checks, message, perfect_at=9.5, details={
        "speedup": round(speedup, 2), "seconds": total, "baseline_seconds": round(baseline, 3), "n": LOAD_N,
    })
