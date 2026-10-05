from typing import Dict, Any

def get_archive_ping() -> Dict[str, Any]:
    return {
        "status": "archived",
        "message": "The press room was sealed in 1963.",
        "next": "/static/js/archive.js",
        "hint": "Examine the client script archive to discover the retrieveBlueprint() protocol and required fragments."
    }

def get_archive_manifest() -> Dict[str, Any]:
    return {
        "archive": "ROYAL-MINT",
        "year": 1963,
        "status": "restricted",
        "files": [
            "/api/archive/public",
            "/api/archive/backup",
            "/api/archive/press"
        ],
        "instruction": "The press record contains the missing piece."
    }

def get_archive_press() -> Dict[str, Any]:
    return {
        "status": "restricted",
        "record": "PRESS-1963",
        "fragment": "Qk1UXzE5NjNfUEJF",
        "encoding": "base64",
        "next": "storage"
    }

def verify_blueprint_query(fragment: str) -> Dict[str, Any]:
    if fragment.strip() == "17-04":
        return {
            "success": True,
            "code": "RM-630417",
            "message": "BLUEPRINT RECOVERED: Royal Mint 1963 classified layout unsealed."
        }
    return {
        "success": False,
        "message": "ACCESS DENIED: Invalid archival fragment signature."
    }

def verify_blueprint_submission(extraction_code: str, fragment: str = None) -> Dict[str, Any]:
    correct_code = "RM-630417"
    is_correct = (extraction_code.strip().upper() == correct_code)
    
    if is_correct:
        msg = f"ARCHIVAL CLEARANCE CONFIRMED: Extraction Code [{correct_code}] authenticated."
    else:
        msg = "INVALID EXTRACTION CODE: The blueprint archive remains locked."
        
    return {
        "passed": is_correct,
        "message": msg,
        "details": {
            "expected_code": correct_code,
            "submitted_code": extraction_code
        }
    }
