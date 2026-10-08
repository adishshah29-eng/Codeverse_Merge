import json
import secrets
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional

from app.phase1.games.sandbox import run_python

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_ANSWER_KEY: Optional[List[float]] = None

def get_answer_key() -> List[float]:
    global _ANSWER_KEY
    if _ANSWER_KEY is None:
        ak_path = DATA_DIR / "answer_key.csv"
        if ak_path.exists():
            df = pd.read_csv(ak_path)
            _ANSWER_KEY = df["amount_printed"].astype(float).tolist()
        else:
            _ANSWER_KEY = []
    return _ANSWER_KEY

def get_dataset_info() -> Dict[str, Any]:
    train_path = DATA_DIR / "train.csv"
    test_path = DATA_DIR / "test.csv"
    
    train_rows = 0
    test_rows = 0
    columns = []
    
    if train_path.exists():
        df_train = pd.read_csv(train_path, nrows=5)
        columns = list(df_train.columns)
        train_rows = 7000
    if test_path.exists():
        test_rows = 1500
        
    return {
        "train_rows": train_rows,
        "test_rows": test_rows,
        "features": [c for c in columns if c not in ("id", "amount_printed")],
        "target": "amount_printed",
        "sample_columns": columns
    }

def evaluate_ml_model(code: str, timeout_seconds: int = 15) -> Dict[str, Any]:
    answer_key = get_answer_key()
    expected_count = len(answer_key) or 1500
    
    # Per-run markers so ordinary output from team code is never mistaken for
    # the wrapper's result lines. Grading itself happens server-side against
    # the answer key, which is never copied into the sandbox.
    nonce = secrets.token_hex(16)
    img_marker = f"__IMG_{nonce}__:"
    val_marker = f"__VAL_{nonce}__:"

    # Python wrapper to run user model, capture predictions and any plot
    wrapper = f"""
import sys
import os
import json

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception:
    pass

import pandas as pd
import numpy as np

# train.csv and test.csv are copied into the sandbox working directory
train_csv = "train.csv"
test_csv = "test.csv"

# Make train_df and test_df available globally
try:
    train_df = pd.read_csv(train_csv)
    test_df = pd.read_csv(test_csv)
except Exception as e:
    pass

user_code = {json.dumps(code)}
runtime_err = None
try:
    compiled = compile(user_code, "solution.py", "exec")
    exec(compiled, globals())
except Exception as e:
    import traceback
    runtime_err = traceback.format_exc()
    sys.stderr.write(runtime_err)

# Capture plot if produced
img_b64 = None
try:
    if "matplotlib.pyplot" in sys.modules:
        _plt = sys.modules["matplotlib.pyplot"]
        if _plt.get_fignums():
            import io
            import base64
            buf = io.BytesIO()
            _plt.savefig(buf, format="png", dpi=100, bbox_inches="tight")
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode("ascii")
            _plt.close("all")
except Exception:
    pass

# Validate predictions variable
val_payload = {{
    "has_error": runtime_err is not None,
    "has_predictions": False,
    "count": 0,
    "has_nan": False,
    "has_inf": False,
    "predictions": None
}}

if not runtime_err and "predictions" in globals():
    raw_preds = globals()["predictions"]
    if raw_preds is not None and raw_preds is not ...:
        val_payload["has_predictions"] = True
        try:
            if isinstance(raw_preds, (pd.Series, pd.DataFrame)):
                arr = raw_preds.to_numpy()
            else:
                arr = np.asarray(raw_preds)
                
            arr_flat = arr.astype(float).reshape(-1)
            val_payload["count"] = len(arr_flat)
            val_payload["has_nan"] = bool(np.isnan(arr_flat).any())
            val_payload["has_inf"] = bool(np.isinf(arr_flat).any())
            
            if not val_payload["has_nan"] and not val_payload["has_inf"]:
                val_payload["predictions"] = [round(float(v), 4) for v in arr_flat[:{expected_count}]]
        except Exception:
            pass

if img_b64:
    print("\\n{img_marker}" + img_b64)
print("\\n{val_marker}" + json.dumps(val_payload))
"""

    # Only the public datasets are copied in; answer_key.csv never enters the sandbox.
    run = run_python(
        wrapper,
        timeout_seconds,
        data_files=[DATA_DIR / "train.csv", DATA_DIR / "test.csv"],
    )
    if run.timed_out:
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": f"Model training/prediction timed out ({timeout_seconds}s limit).",
            "stdout": "",
            "stderr": "Execution timeout.",
            "image": None
        }
    if run.busy:
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": run.stderr,
            "stdout": "",
            "stderr": run.stderr,
            "image": None
        }

    stdout_raw = run.stdout
    stderr_raw = run.stderr
    
    img_b64 = None
    val_payload = {}
    clean_stdout = []
    
    for line in stdout_raw.splitlines():
        if line.startswith(img_marker):
            img_b64 = line[len(img_marker):].strip()
        elif line.startswith(val_marker):
            try:
                val_payload = json.loads(line[len(val_marker):].strip())
            except Exception:
                pass
        else:
            clean_stdout.append(line)
            
    stdout_clean = "\n".join(clean_stdout).strip()
    
    # Validation checks
    if run.returncode != 0 or val_payload.get("has_error"):
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": "Execution Error: Script raised an unhandled exception.",
            "stdout": stdout_clean,
            "stderr": stderr_raw,
            "image": img_b64
        }
        
    if not val_payload.get("has_predictions"):
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": "Variable 'predictions' was not assigned by your model.",
            "stdout": stdout_clean,
            "stderr": stderr_raw,
            "image": img_b64
        }
        
    if val_payload.get("has_nan") or val_payload.get("has_inf"):
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": "Predictions contain invalid NaN or Infinite values.",
            "stdout": stdout_clean,
            "stderr": stderr_raw,
            "image": img_b64
        }
        
    preds = val_payload.get("predictions")
    if not preds or len(preds) != expected_count:
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": f"Expected exactly {expected_count} predictions for test.csv, but got {val_payload.get('count', 0)}.",
            "stdout": stdout_clean,
            "stderr": stderr_raw,
            "image": img_b64
        }
        
    # Grade against server-side answer key
    sum_actual = sum(answer_key)
    sum_abs_err = sum(abs(p - a) for p, a in zip(preds, answer_key))
    error_pct = (sum_abs_err / sum_actual) * 100.0 if sum_actual > 0 else 0.0
    
    passed = (error_pct <= 50.0) # Within valid benchmark range
    
    return {
        "passed": passed,
        "error_pct": round(error_pct, 2),
        "message": f"BENCHMARK COMPLETE: Achieved {error_pct:.2f}% overall test error.",
        "stdout": stdout_clean,
        "stderr": stderr_raw,
        "image": img_b64
    }
