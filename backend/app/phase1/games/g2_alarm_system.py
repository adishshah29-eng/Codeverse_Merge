import subprocess
import sys
import tempfile
import os
from typing import Dict, Any, List, Optional

# The 10 disarm subroutines with their buggy starter code & expected output
CHALLENGES = [
    {
        "id": "alarm-01",
        "stageNumber": 1,
        "title": "Telemetry Matrix Robust Z-Score Normalization",
        "category": "NumPy Vectorized Cleaning",
        "expectedOutput": "DISARM_SEQ: NP-ROBUST-Z-02-319.54",
        "description": "Clean NaN dropouts and calculate modified Z-scores based on Median Absolute Deviation (MAD). 3 bugs present.",
        "buggyCode": """import numpy as np

def compute_robust_z_scores(raw_data: np.ndarray) -> str:
    col_medians = np.nanmedian(raw_data, axis=1)
    inds = np.where(np.isnan(raw_data))
    cleaned = raw_data.copy()
    cleaned[inds] = 0.0

    medians = np.median(cleaned, axis=0)
    deviations = np.abs(cleaned - medians)
    mad = np.mean(deviations, axis=0)
    mad = np.where(mad == 0, 1e-6, mad)

    mod_z = 0.6745 * (cleaned - medians) / mad
    outlier_count = int(np.sum(np.abs(mod_z) > 3.5))
    max_score = float(np.max(np.abs(mod_z)))

    return f"DISARM_SEQ: NP-ROBUST-Z-{outlier_count:02d}-{max_score:.2f}"

if __name__ == "__main__":
    telemetry = np.array([
        [10.2, 45.1, np.nan, 120.5],
        [11.5, 47.0, 310.2, 122.1],
        [9.8, np.nan, 305.0, 119.8],
        [10.5, 46.2, 315.4, 121.0],
        [150.0, 48.1, 312.0, 500.0],
        [10.1, 45.8, 308.5, 120.2],
        [10.4, 46.5, 309.1, 121.4],
        [10.0, 45.2, 307.8, 120.9],
        [9.9, 46.0, 311.2, 121.1],
        [10.3, 45.9, 309.9, 120.7],
    ])
    print(compute_robust_z_scores(telemetry))
"""
    },
    {
        "id": "alarm-02",
        "stageNumber": 2,
        "title": "Financial Ledger Rolling VWAP & Anomaly Filter",
        "category": "Pandas Time-Series",
        "expectedOutput": "DISARM_SEQ: PD-VWAP-3800-1.46",
        "description": "Calculate 3-period rolling Volume Weighted Average Price (VWAP). 3 bugs present.",
        "buggyCode": """import pandas as pd
import numpy as np

def calculate_rolling_vwap(data: list[dict]) -> str:
    df = pd.DataFrame(data)
    df.sort_values(by=["symbol", "timestamp"])

    df["pv"] = df["price"] * df["volume"]
    df["rolling_pv"] = df.groupby("symbol")["pv"].rolling(3, min_periods=1).sum().values
    df["rolling_vol"] = df.groupby("symbol")["volume"].rolling(3, min_periods=1).sum().values

    df["vwap"] = df["rolling_pv"] / df["volume"]
    df["pct_dev"] = ((df["price"] - df["vwap"]) / df["price"]) * 100

    last_vol = int(df["rolling_vol"].iloc[-1])
    last_dev = float(df["pct_dev"].iloc[-1])
    return f"DISARM_SEQ: PD-VWAP-{last_vol}-{last_dev:.2f}"

if __name__ == "__main__":
    records = [
        {"timestamp": "09:00", "symbol": "EUR", "price": 1.0850, "volume": 1000},
        {"timestamp": "09:05", "symbol": "EUR", "price": 1.0860, "volume": 1200},
        {"timestamp": "09:10", "symbol": "EUR", "price": 1.0845, "volume": 1500},
        {"timestamp": "09:15", "symbol": "EUR", "price": 1.0880, "volume": 1100},
    ]
    print(calculate_rolling_vwap(records))
"""
    },
    {
        "id": "alarm-03",
        "stageNumber": 3,
        "title": "Intrusion Detector Logistic Regression Calibration",
        "category": "Scikit-Learn Classification",
        "expectedOutput": "DISARM_SEQ: SK-LOGREG-AUC-1.00-ACC-4",
        "description": "Train a Logistic Regression classifier for vault perimeter breach detection. 3 bugs present.",
        "buggyCode": """import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

def calibrate_intrusion_detector(X_train, y_train, X_test, y_test) -> str:
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.fit_transform(X_test)

    clf = LogisticRegression(random_state=42)
    clf.fit(X_train_scaled, y_train)

    probs = clf.predict_proba(X_test_scaled)[:, 1]
    auc = roc_auc_score(y_test, clf.predict(X_test_scaled))

    threshold = 0.55
    preds = (probs < threshold).astype(int)
    correct_count = int(np.sum(preds == y_test))

    return f"DISARM_SEQ: SK-LOGREG-AUC-{auc:.2f}-ACC-{correct_count}"

if __name__ == "__main__":
    X_tr = np.array([[1.0, 20.0], [2.0, 22.0], [5.0, 80.0], [6.0, 85.0]])
    y_tr = np.array([0, 0, 1, 1])
    X_te = np.array([[1.5, 21.0], [5.5, 82.0], [1.2, 19.0], [6.2, 88.0]])
    y_te = np.array([0, 1, 0, 1])
    print(calibrate_intrusion_detector(X_tr, y_tr, X_te, y_te))
"""
    }
]

def get_challenges_list() -> List[Dict[str, Any]]:
    return [
        {
            "id": c["id"],
            "stageNumber": c["stageNumber"],
            "title": c["title"],
            "category": c["category"],
            "description": c["description"],
            "buggyCode": c["buggyCode"]
        }
        for c in CHALLENGES
    ]

def get_challenge_by_id(cid: str) -> Optional[Dict[str, Any]]:
    for c in CHALLENGES:
        if c["id"] == cid:
            return c
    return None

def execute_python_code(code: str, timeout_seconds: int = 5) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(code)
        tmp_name = tmp.name

    try:
        proc = subprocess.run(
            [sys.executable, tmp_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds
        )
        return {
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "exitCode": proc.returncode,
            "timeout": False
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Execution timed out ({timeout_seconds}s limit).",
            "exitCode": -1,
            "timeout": True
        }
    finally:
        try:
            os.remove(tmp_name)
        except Exception:
            pass

def verify_alarm_solution(challenge_id: str, code: str) -> Dict[str, Any]:
    ch = get_challenge_by_id(challenge_id)
    if not ch:
        return {"passed": False, "message": "Unknown challenge ID.", "stdout": "", "stderr": ""}

    run_res = execute_python_code(code)
    stdout_trimmed = run_res["stdout"].strip()
    expected = ch["expectedOutput"].strip()

    passed = (run_res["exitCode"] == 0 and expected in stdout_trimmed)

    if passed:
        msg = f"SECURITY OVERRIDE ACCEPTED: Disarm sequence [{expected}] verified!"
    elif run_res["exitCode"] != 0:
        msg = f"RUNTIME EXCEPTION: Script exited with code {run_res['exitCode']}. See console error."
    else:
        msg = f"DISARM SIGNATURE MISMATCH: Output did not contain expected sequence frequency."

    return {
        "passed": passed,
        "stdout": run_res["stdout"],
        "stderr": run_res["stderr"],
        "exitCode": run_res["exitCode"],
        "message": msg,
        "challenge_title": ch["title"]
    }
