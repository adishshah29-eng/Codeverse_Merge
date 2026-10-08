"""Stage 4 — Spreadsheet engine.

Teams submit ``engine.py`` (the formula engine behind the pygame grid handout). The organizer's headless grader
``competition/p4_spreadsheet/organizer/grade_engine.py`` runs inside the sandbox; cases are weighted by tier
(baseline = eval + precedence, core = chains + propagation, hard = minimal recompute + cycles).
"""
from typing import Any, Dict

from app.phase1.games.common import check, run_failure, problem_dir, read_text, result, run_with_marker

PROBLEM = "p4_spreadsheet"
TIMEOUT = 60

META = {
    "id": 4,
    "title": "Spreadsheet engine — formulas, references, cycles",
    "domain": "Parsing + dependency graphs",
    "difficulty": "Medium–Hard",
    "handout": PROBLEM,
    "brief": (
        "The handout contains a finished pygame spreadsheet grid (ui.py) with no formula logic: typing =A1*A0 just "
        "shows the literal text. You write the formula engine behind it in engine.py.\n\n"
        "Required: formulas start with = and support + - * /, parentheses, numbers and cell references like A0, B3. "
        "A reference resolves to that cell's computed value, so formulas chain (A3 = B3*B1 where B3 and B1 may be "
        "formulas). Changing a cell recomputes everything downstream of it in dependency (topological) order — not a "
        "blind full-grid recompute. A reference cycle (A0 = =A1, A1 = =A0) must show #CYCLE in the offending cells — no "
        "infinite loop, no crash.\n\n"
        "Canonical cases: A0=4, A1=3, A2==A1*A0 → 12;  B1=2, B3=5, A3==B3*B1 → 10;  =1+2*3 → 7;  then A0=5 → A2 becomes 15.\n\n"
        "The full API and error codes are in the docstring of engine.py (keep the class and method names!). "
        "Grading is headless. Basic eval + precedence are the baseline, chained references + propagation the core, "
        "minimal recompute + cycle handling is where the top teams separate."
    ),
    "submit": {
        "files": {"mode": "single", "names": ["engine.py"]},
        "fields": [],
    },
    "hints": [
        "Don't evaluate text with eval(). Tokenize, then parse with precedence (expr → term → factor), producing a small tree you can evaluate repeatedly.",
        "Keep two maps: for each cell the cells it READS, and for each cell the cells that READ it. A change only needs to walk the second map.",
        "Take the changed cell plus everything downstream, then evaluate in topological order (Kahn's algorithm). Any cell that never reaches in-degree 0 is part of, or behind, a cycle → #CYCLE.",
    ],
}

RUNNER = r'''
import contextlib, io, json, os, sys, traceback

def _main():
    marker = "__RES_@@NONCE@@__:"
    sys.path.insert(0, os.getcwd())
    out = {"loaded": False, "error": "grader did not run"}
    try:
        import grade_engine
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
            grade_engine.main(os.path.join(os.getcwd(), "engine.py"), 5)
        lines = [l for l in buf.getvalue().splitlines() if l.startswith('{"loaded"')]
        if lines:
            out = json.loads(lines[-1])
    except BaseException:
        out = {"loaded": False, "error": traceback.format_exc()[-1200:]}
    print("\n" + marker + json.dumps(out))

_main()
'''


def grade(files: Dict[str, str], answers: Dict[str, str]) -> Dict[str, Any]:
    source = (files.get("engine.py") or "").strip()
    if not source:
        return result([], "Submit your engine.py.", valid=False)
    grader = read_text(problem_dir(PROBLEM) / "organizer" / "grade_engine.py")
    run, payload = run_with_marker(RUNNER, {"engine.py": source, "grade_engine.py": grader}, TIMEOUT)
    if payload is None:
        return run_failure(run, TIMEOUT)
    if not payload.get("loaded"):
        return result([], "Your engine.py could not be loaded: " + str(payload.get("error", ""))[:600], valid=False)

    cases = payload["cases"]
    total_weight = sum(c["weight"] for c in cases) or 1
    checks = []
    tier_totals: Dict[str, list] = {}
    for case in cases:
        points = 10.0 * case["weight"] / total_weight
        checks.append(check(case["name"], case["passed"], points, points,
                            case["note"] if case["note"] else (f"{case['tier']} tier" if case["passed"] else f"{case['tier']} tier — failed")))
        tier_totals.setdefault(case["tier"], [0, 0])
        tier_totals[case["tier"]][1] += 1
        tier_totals[case["tier"]][0] += 1 if case["passed"] else 0
    passed = sum(1 for c in cases if c["passed"])
    summary = " · ".join(f"{tier} {a}/{b}" for tier, (a, b) in tier_totals.items())
    return result(checks, f"{passed}/{len(cases)} grader cases pass ({summary}).", perfect_at=9.95,
                  details={"tiers": tier_totals})
