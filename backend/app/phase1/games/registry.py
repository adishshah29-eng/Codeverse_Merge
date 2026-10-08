"""The five Phase 1 challenges, in stage order."""
from fastapi import HTTPException

from app.phase1.games import g1_url_shortener, g2_todo_bugs, g3_ctf, g4_spreadsheet, g5_regression

STAGES = {
    1: g1_url_shortener,
    2: g2_todo_bugs,
    3: g3_ctf,
    4: g4_spreadsheet,
    5: g5_regression,
}


def get_stage(stage_id: int):
    stage = STAGES.get(stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Unknown stage.")
    return stage


def hint_texts(stage_id: int) -> list:
    return list(get_stage(stage_id).META.get("hints", []))
