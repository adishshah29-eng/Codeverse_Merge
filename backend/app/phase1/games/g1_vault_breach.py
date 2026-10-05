import json
from pathlib import Path
from typing import Dict, Any, List

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "g1_vault_breach"

def load_public_challenge() -> Dict[str, Any]:
    pub_file = DATA_DIR / "public.json"
    if pub_file.exists():
        with open(pub_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "challenge_id": "codeverse-2-0-royal-mint-v1",
        "title": "EL CODIGO ROJO",
        "duration_seconds": 900,
        "evidence": []
    }

def verify_vault_solution(
    final_code: str,
    extracted_door: int = None,
    extracted_witness: int = None,
    extracted_metal: int = None,
    shift: int = None
) -> Dict[str, Any]:
    """
    Checks the submitted Vault PIN.
    Correct Solution:
    - Shift = 3 (keys carried on line)
    - Door = 38 -> shifted by 3 -> 61
    - Witness = 25 -> shifted by 3 -> 58
    - Metal = 47 -> shifted by 3 -> 70
    - Final Code = "615870"
    """
    correct_code = "615870"
    is_correct = (final_code.strip() == correct_code)
    
    # Never echo the solution back to the client (it was previously returned
    # on wrong submissions, letting teams read the PIN from the response).
    details = {"code_matched": is_correct}
    
    if is_correct:
        message = "ACCESS GRANTED: Vault door locking mechanism neutralized! Safe open."
    else:
        message = "ACCESS DENIED: Master tumbler rejected the combination. Check your evidence deductions."
        
    return {
        "passed": is_correct,
        "message": message,
        "details": details
    }
