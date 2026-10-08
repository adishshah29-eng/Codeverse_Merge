"""End-to-end test of the Phase 1 challenge flow through the real API (sandbox runs included)."""
import glob
import io
import os
import time
import uuid
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

COMP = Path(__file__).resolve().parents[2] / "competition"


def _read(rel):
    return (COMP / rel).read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def team(client):
    admin = client.post("/api/auth/admin-login", json={"username": "organizer", "password": "organizer-password-123"})
    assert admin.status_code == 200, admin.text
    r = client.post("/api/admin/teams", json={"code": "T1", "name": "Tester", "email": "t@example.com", "password": "password123"})
    assert r.status_code in (200, 201), r.text
    client.cookies.clear()
    r = client.post("/api/auth/login", json={"email": "t@example.com", "password": "password123"})
    assert r.status_code == 200, r.text
    return client


def submit(c, stage, files=None, answers=None):
    time.sleep(4.1)  # per-team submission cooldown
    r = c.post(f"/api/phase1/games/{stage}/submit",
               json={"idempotency_key": uuid.uuid4().hex, "files": files or {}, "answers": answers or {}})
    assert r.status_code == 200, r.text
    return r.json()


def dashboard(c):
    return c.get("/api/phase1/progress/dashboard").json()


def test_dashboard_has_new_stage_names(team):
    d = dashboard(team)
    assert [s["stage_name"].split(" (")[0] for s in d["stages"]] == [
        "URL Shortener", "TODO API Bug Hunt", "CTF Binary", "Spreadsheet Engine", "Linear Regression"]
    assert d["current_stage"] == 1


def test_locked_stage_is_forbidden(team):
    assert team.get("/api/phase1/games/3/brief").status_code == 403


def test_stage1_brief_and_handout(team):
    brief = team.get("/api/phase1/games/1/brief").json()
    assert brief["title"].startswith("URL Shortener") and brief["hints_total"] == 3
    z = team.get("/api/phase1/games/1/handout")
    assert z.status_code == 200 and z.headers["content-type"] == "application/zip"
    names = zipfile.ZipFile(io.BytesIO(z.content)).namelist()
    assert "p1_url_shortener/shortener.py" in names and not any("organizer" in n or "solution" in n for n in names)


def test_hint_returns_text_and_costs_points(team):
    r = team.post("/api/phase1/progress/hint", json={"stage_id": 1, "hint_index": 0}).json()
    assert r["success"] and r["text"] and r["penalty"] == 0.5
    brief = team.get("/api/phase1/games/1/brief").json()
    assert [h["index"] for h in brief["unlocked_hints"]] == [0]
    assert team.post("/api/phase1/progress/hint", json={"stage_id": 1, "hint_index": 9}).status_code == 404


def test_stage1_slow_baseline_gets_partial_then_fast_completes(team):
    baseline = _read("p1_url_shortener/handout/shortener.py")
    r = submit(team, 1, {"shortener.py": baseline})
    assert r["success"] and not r["passed"] and 2.0 <= r["feedback"]["raw_score"] < 3.0
    assert dashboard(team)["current_stage"] == 1                  # not finished yet
    fast = _read("p1_url_shortener/organizer/solution_shortener.py")
    r = submit(team, 1, {"shortener.py": fast}, {"note": "linear scan -> reverse map; json file re-read -> memory; random collision retry -> set; LRU cache"})
    assert r["passed"] and r["next_stage"] == 2
    d = dashboard(team)
    assert d["current_stage"] == 2
    stage1 = d["stages"][0]
    assert stage1["status"] == "COMPLETED" and stage1["score"] == pytest.approx(9.5)   # 10 - hint 0.5


def test_stage1_cannot_be_submitted_again(team):
    r = team.post("/api/phase1/games/1/submit", json={"idempotency_key": "x1", "files": {"shortener.py": "x"}})
    assert r.status_code == 400


def test_stage2_partial_finalize(team):
    solution = {f"app/{os.path.basename(p)}": Path(p).read_text()
                for p in glob.glob(str(COMP / "p2_todo_bugs/organizer/solution/app/*.py"))}
    crud_only = {"app/crud.py": solution["app/crud.py"]}                 # fixes medium + hard, not the easy status code
    notes = {"medium": "skip is a count of rows to skip, so skip-1 is an off-by-one that repeats a row",
             "hard": "flush never commits: the session closes and rolls back so the next request misses it"}
    r = submit(team, 2, crud_only, notes)
    assert not r["passed"] and r["feedback"]["raw_score"] == pytest.approx(10 / 6 * 4, abs=0.02)
    f = team.post("/api/phase1/games/2/finalize")
    assert f.status_code == 200 and f.json()["next_stage"] == 3
    assert dashboard(team)["current_stage"] == 3


def test_stage3_wrong_then_right(team):
    r = submit(team, 3, answers={"password": "wrong", "flag": "flag{no}"})
    assert not r["success"] and r["score_awarded"] == 0
    r = submit(team, 3, answers={
        "password": "r3v3rs3_m3_pls", "flag": "flag{stage1_cleared_on_to_the_next}",
        "note": "ran ltrace and read the strcmp arguments",
        "bonus_password": "r3v3rs3_m3_pls", "bonus_flag": "flag{stage1_cleared_on_to_the_next}"})
    assert r["passed"] and r["next_stage"] == 4
    s3 = dashboard(team)["stages"][2]
    assert s3["status"] == "COMPLETED" and s3["wrong_attempts"] == 1 and s3["score"] == pytest.approx(10 - 0.25)


def test_stage4_engine(team):
    r = submit(team, 4, {"engine.py": _read("p4_spreadsheet/organizer/solution_engine.py")})
    assert r["passed"] and r["next_stage"] == 5


def test_stage5_regression_completes_mission(team):
    r = submit(team, 5, {"solution.py": _read("p5_regression/organizer/solution.py")})
    assert r["passed"] and r["mission_complete"]
    d = dashboard(team)
    assert d["current_stage"] == 6
    assert d["total_score"] == pytest.approx(9.5 + 10 / 6 * 4 + 9.75 + 10 + 10, abs=0.05)


def test_leaderboard_lists_team(team):
    lb = team.get("/api/phase1/leaderboard").json()["leaderboard"]
    assert lb and lb[0]["team_name"] == "Tester" and lb[0]["completed_stages_count"] == 5
