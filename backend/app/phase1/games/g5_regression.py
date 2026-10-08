"""Stage 5 — Linear regression: the model that lies to you.

Teams submit code defining ``fit_predict(train_df, test_df) -> (predictions, coefficients)`` and a ``report`` dict with
one line per trap. The sandbox calls it on five 80 % resamples of ``housing.csv`` and asks for predictions on a hidden
holdout (features only). Truth never enters the sandbox; every check below runs server-side.
"""
import json
import re
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from app.phase1.games.common import check, run_failure, keyword_hits, problem_dir, result, run_with_marker

PROBLEM = "p5_regression"
TIMEOUT = 60
SEEDS = 5
SQM = 0.092903

META = {
    "id": 10,
    "title": "Linear regression — the model that lies to you",
    "domain": "ML / diagnosis",
    "difficulty": "Medium",
    "handout": PROBLEM,
    "brief": (
        "housing.csv hands you a plain LinearRegression with a great training R² that falls apart on test. Something is "
        "wrong with the data, the model, or both. Diagnose it (residuals-vs-fitted plot, VIF, ...), fix it, and justify "
        "every change. A model that merely scores high once is not enough: it must be stable across seeds and its "
        "coefficients must make sense.\n\n"
        "Write fit_predict(train_df, test_df) -> (predictions, coefficients) and a report dict with ONE line per trap "
        "(leak, collinearity, nonlinearity, outliers) naming the diagnostic that caught it — quote the evidence (VIF "
        "numbers, correlation, what the residual plot looked like). Coefficients are a dict {feature: value in the "
        "ORIGINAL units of the column}; its keys are taken as the features you use. See starter.py in the handout.\n\n"
        "Graded on a hidden holdout over 5 resampled seeds (10): leak 2 · sane coefficients 1.5 · non-linearity 1.5 · "
        "outliers/heteroscedasticity 1.5 · stability 1 · report lines 2 · numeric VIF evidence 0.5."
    ),
    "submit": {
        "files": {"mode": "single", "names": ["solution.py"]},
        "fields": [],
    },
    "hints": [
        "Compare train and test R². A feature that makes train R² jump to ~0.94 yet collapses on test deserves one question: could you know it for a house you haven't sold yet?",
        "Compute VIF for every numeric feature (regress each on the others: VIF = 1/(1−R²)). Then plot residuals against fitted values AND against each feature — look for curves and fans.",
        "Fixes in order: drop the leaked column; drop one of the near-duplicate areas (or use Ridge); add an (age − 30)² term; use a robust fit (Huber / RANSAC) or justify removing the three luxury outliers.",
    ],
}

RUNNER = r'''
import contextlib, io, json, os, sys, traceback

def _main():
    marker = "__RES_@@NONCE@@__:"
    out = {"error": None, "seeds": [], "report": {}}
    sys.path.insert(0, os.getcwd())
    try:
        import numpy as np
        import pandas as pd
        train_df = pd.read_csv("housing.csv")
        test_df = pd.read_csv("housing_test.csv")
        holdout = pd.read_csv("__holdout.csv")
        code = open("solution.py", encoding="utf-8").read()
        env = {"__name__": "solution", "train_df": train_df.copy(), "test_df": test_df.copy(), "pd": pd, "np": np}
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            exec(compile(code, "solution.py", "exec"), env)
            fit_predict = env["fit_predict"]
            for seed in range(@@SEEDS@@):
                sub = train_df.sample(frac=0.8, random_state=seed).reset_index(drop=True)
                preds, coefs = fit_predict(sub.copy(), holdout.copy())
                preds = np.asarray(preds, dtype=float).reshape(-1)
                out["seeds"].append({
                    "preds": [round(float(v), 3) for v in preds],
                    "coefs": {str(k): float(v) for k, v in dict(coefs).items()},
                })
        rep = env.get("report", {})
        out["report"] = {str(k): str(v)[:600] for k, v in dict(rep).items()} if isinstance(rep, dict) else {}
    except BaseException:
        out["error"] = traceback.format_exc()[-1500:]
    print("\n" + marker + json.dumps(out))

_main()
'''

REPORT_RULES = {
    "leak": ([r"price_per_sqft|per_sqft|leak", r"target|price\b|inference|deriv|comput|future|unavailable|not available|test"], "leak"),
    "collinearity": ([r"vif|collinear|correlat|duplicate|variance inflation", r"area_sqm|sqm|sqft|drop|ridge|coeffic|unstable"], "collinearity"),
    "nonlinearity": ([r"residual|curv|quadratic|squared|\^2|\*\*2|_sq|non-?linear|u-?shape", r"age"], "nonlinearity"),
    "outliers": ([r"outlier|heteroscedast|robust|huber|ransac|leverage|cook|fan|funnel|weighted|wls|log|luxury|variance"], "outliers"),
}


def _holdout_truth() -> pd.DataFrame:
    return pd.read_csv(problem_dir(PROBLEM) / "organizer" / "hidden_holdout.csv")


def _r2(y: np.ndarray, p: np.ndarray) -> float:
    ss_res = float(np.sum((y - p) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    return 1.0 - ss_res / ss_tot


def _coefficient_problems(coefs: Dict[str, float]) -> List[str]:
    """Plain-units sanity: nothing absurd, signs make sense. Returns human-readable problems."""
    problems = []
    low = {k.lower(): v for k, v in coefs.items()}
    bounds = {"area_sqft": (0.0, 600.0), "area_sqm": (0.0, 6500.0), "dist_km": (-12000.0, 0.0), "bedrooms": (-30000.0, 40000.0)}
    for name, (lo, hi) in bounds.items():
        if name in low and not lo <= low[name] <= hi:
            problems.append(f"{name} = {low[name]:,.1f} (expected roughly {lo:,.0f} … {hi:,.0f} per unit)")
    if "area_sqft" in low or "area_sqm" in low:
        effective = low.get("area_sqft", 0.0) + low.get("area_sqm", 0.0) / SQM
        if effective < 0:
            problems.append(f"effective price per sqft is negative ({effective:,.0f})")
    if not ("area_sqft" in low or "area_sqm" in low):
        problems.append("no area feature in the model")
    return problems


def grade(files: Dict[str, str], answers: Dict[str, str]) -> Dict[str, Any]:
    code = (files.get("solution.py") or "").strip()
    if not code:
        return result([], "Submit your solution.py (fit_predict + report).", valid=False)
    if "def fit_predict" not in code:
        return result([], "Your code must define fit_predict(train_df, test_df) -> (predictions, coefficients).", valid=False)

    handout = problem_dir(PROBLEM) / "handout"
    truth = _holdout_truth()
    features_csv = (problem_dir(PROBLEM) / "organizer" / "hidden_holdout_features.csv").read_text(encoding="utf-8")
    sandbox_files = {
        "solution.py": code,
        "housing.csv": (handout / "housing.csv").read_text(encoding="utf-8"),
        "housing_test.csv": (handout / "housing_test.csv").read_text(encoding="utf-8"),
        "__holdout.csv": features_csv,
    }
    run, payload = run_with_marker(RUNNER.replace("@@SEEDS@@", str(SEEDS)), sandbox_files, TIMEOUT)
    if payload is None:
        return run_failure(run, TIMEOUT)
    if payload.get("error"):
        return result([], "Your code raised an error:\n" + payload["error"], valid=False)

    y = truth["price"].to_numpy(float)
    seeds = payload["seeds"]
    if len(seeds) != SEEDS or any(len(s["preds"]) != len(y) for s in seeds):
        return result([], f"fit_predict must return exactly {len(y)} predictions (one per test_df row).", valid=False)
    preds = [np.asarray(s["preds"], dtype=float) for s in seeds]
    if any(not np.isfinite(p).all() for p in preds):
        return result([], "Predictions contain NaN / infinite values.", valid=False)

    r2s = [_r2(y, p) for p in preds]
    features = sorted({k for s in seeds for k in s["coefs"]})
    mean_coefs = {k: float(np.mean([s["coefs"].get(k, 0.0) for s in seeds])) for k in features}

    # trap 2 — leak: a column derived from the target (or the target itself) must not be used
    leaked = [f for f in features if re.search(r"per_sqft|price", f, re.I)]
    # trap 1 — collinearity: coefficients in original units must be believable
    coef_problems = _coefficient_problems(mean_coefs)
    # trap 3 — non-linearity: residuals in the very new / very old homes (where a straight line is wrong)
    age = truth["age"].to_numpy(float)
    area = truth["area_sqft"].to_numpy(float)
    tail, big = (age < 10) | (age > 55), area > 2600
    median_seed = int(np.argsort(r2s)[len(r2s) // 2])
    resid = y - preds[median_seed]
    tail_bias = abs(float(resid[tail].mean())) / float(y.mean())
    big_bias = abs(float(resid[big].mean())) / float(y[big].mean())
    spread = max(r2s) - min(r2s)

    checks = [
        check("Leaky feature removed", not leaked and r2s[0] > 0.5, 2.0, 2.0,
              ("uses " + ", ".join(leaked) + " — a column built from the target isn't available at prediction time") if leaked
              else (f"holdout R² only {r2s[0]:.2f}" if r2s[0] <= 0.5 else "no target-derived feature in the model")),
        check("Collinearity resolved — coefficients make sense", not coef_problems, 1.5, 1.5,
              "; ".join(coef_problems) if coef_problems else "area, bedroom and distance effects are plausible per unit"),
        check("Non-linearity captured", tail_bias < 0.03 and not leaked, 1.5, 1.5,
              f"error in the newest/oldest homes is {tail_bias:.1%} of mean price (needs < 3%) — look at the residuals vs age"),
        check("Outliers / heteroscedasticity handled", big_bias < 0.02 and not leaked, 1.5, 1.5,
              f"error in large homes is {big_bias:.1%} of their mean price (needs < 2%) — the three luxury homes drag the line"),
        check("Stable across seeds", min(r2s) >= 0.93 and spread <= 0.03, 1.0, 1.0,
              f"holdout R² over {SEEDS} resamples: " + ", ".join(f"{v:.3f}" for v in r2s) + " (need all ≥ 0.93, spread ≤ 0.03)"),
    ]

    report = payload.get("report") or {}
    for trap, (patterns, _) in REPORT_RULES.items():
        text = report.get(trap, "")
        need = 2 if len(patterns) > 1 else 1
        ok = len(text.strip()) >= 20 and keyword_hits(text, patterns) >= need
        checks.append(check(f"Report — {trap}", ok, 0.5, 0.5,
                            "names the diagnostic" if ok else "one line naming the trap AND the diagnostic that caught it (≥ 20 chars)"))
    evidence = bool(re.search(r"vif\D{0,40}\d{2,}|\d{2,}\D{0,30}vif", report.get("collinearity", ""), re.I))
    checks.append(check("Report — numeric VIF evidence", evidence, 0.5, 0.5,
                        "VIF numbers quoted" if evidence else "quote the actual VIF values in the collinearity line"))

    passed = sum(1 for c in checks[:5] if c["passed"])
    message = f"{passed}/5 modelling checks pass · holdout R² {np.median(r2s):.3f}."
    return result(checks, message, perfect_at=9.5, details={
        "holdout_r2": [round(v, 4) for v in r2s], "features": features,
        "coefficients": {k: round(v, 3) for k, v in mean_coefs.items()},
        "tail_bias": round(tail_bias, 4), "big_bias": round(big_bias, 4),
        "report": report,
    })
