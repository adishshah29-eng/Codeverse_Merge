import os
import sys
import json
import tempfile
import subprocess
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Any, List, Optional

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

# Prepare current directory data references
data_dir = r"{str(DATA_DIR)}"
train_csv = os.path.join(data_dir, "train.csv")
test_csv = os.path.join(data_dir, "test.csv")

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
    print("\\n__IMG__:" + img_b64)
print("\\n__VAL__:" + json.dumps(val_payload))
"""

    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as tmp:
        tmp.write(wrapper)
        tmp_name = tmp.name

    try:
        proc = subprocess.run(
            [sys.executable, tmp_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_seconds,
            cwd=str(DATA_DIR)
        )
        
        stdout_raw = proc.stdout
        stderr_raw = proc.stderr
        
        img_b64 = None
        val_payload = {}
        clean_stdout = []
        
        for line in stdout_raw.splitlines():
            if line.startswith("__IMG__:"):
                img_b64 = line[8:].strip()
            elif line.startswith("__VAL__:"):
                try:
                    val_payload = json.loads(line[8:].strip())
                except Exception:
                    pass
            else:
                clean_stdout.append(line)
                
        stdout_clean = "\n".join(clean_stdout).strip()
        
        # Validation checks
        if proc.returncode != 0 or val_payload.get("has_error"):
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
        
    except subprocess.TimeoutExpired:
        return {
            "passed": False,
            "error_pct": 100.0,
            "message": f"Model training/prediction timed out ({timeout_seconds}s limit).",
            "stdout": "",
            "stderr": "Execution timeout.",
            "image": None
        }
    finally:
        try:
            os.remove(tmp_name)
        except Exception:
            pass
