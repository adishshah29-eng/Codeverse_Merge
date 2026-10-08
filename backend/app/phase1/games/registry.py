"""The five Challenge Arena stages (6-10). Stages 1-5 (Royal Mint Heist) use the original engines/routers."""
from fastapi import HTTPException

from app.phase1.games import g1_url_shortener, g2_todo_bugs, g3_ctf, g4_spreadsheet, g5_regression

STAGES = {
    6: g1_url_shortener,
    7: g2_todo_bugs,
    8: g3_ctf,
    9: g4_spreadsheet,
    10: g5_regression,
}


def get_stage(stage_id: int):
    stage = STAGES.get(stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Unknown stage.")
    return stage


def hint_texts(stage_id: int) -> list:
    stage = STAGES.get(stage_id)
    return list(stage.META.get("hints", [])) if stage else []
