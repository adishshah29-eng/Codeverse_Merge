import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_unified_flow():
    print("== 1. Health Check ==")
    res = client.get("/health")
    assert res.status_code == 200, res.text
    print("Health check OK:", res.json())

    print("\n== 2. Team A & Team B Registration ==")
    res_a = client.post("/api/auth/register", json={"name": "Team Tokyo", "passcode": "tokyo123"})
    assert res_a.status_code == 200, res_a.text
    team_a = res_a.json()["team"]
    team_a_id = team_a["id"]
    print("Team Tokyo created with ID:", team_a_id)

    res_b = client.post("/api/auth/register", json={"name": "Team Berlin", "passcode": "berlin123"})
    assert res_b.status_code == 200, res_b.text
    team_b = res_b.json()["team"]
    team_b_id = team_b["id"]
    print("Team Berlin created with ID:", team_b_id)

    print("\n== 3. Team Tokyo Dashboard (Game 1 Active, Games 2-5 Locked) ==")
    res_dash = client.get("/api/progress/dashboard", headers={"X-Team-ID": team_a_id})
    assert res_dash.status_code == 200, res_dash.text
    dash = res_dash.json()
    assert dash["current_stage"] == 1
    assert dash["stages"][0]["status"] == "ACTIVE"
    assert dash["stages"][1]["status"] == "LOCKED"
    print("Team Tokyo Current Stage:", dash["current_stage"], "| Stage 1 Status:", dash["stages"][0]["status"])

    print("\n== 4. Anti-Cheat: Attempt to submit Game 2 while on Game 1 (Must be 403 Forbidden) ==")
    res_forbidden = client.post(
        "/api/games/2/submit",
        json={"idempotency_key": "cheat-1", "challenge_id": "alarm-01", "code": "print(1)"},
        headers={"X-Team-ID": team_a_id}
    )
    assert res_forbidden.status_code == 403, f"Expected 403 Forbidden, got {res_forbidden.status_code}"
    print("Anti-Cheat successfully blocked premature Game 2 submission: 403 Forbidden!")

    print("\n== 5. Game 1: Submit Incorrect PIN (Access Denied, Score = 0) ==")
    res_wrong = client.post(
        "/api/games/1/submit",
        json={"idempotency_key": "sub-wrong-1", "final_code": "000000"},
        headers={"X-Team-ID": team_a_id}
    )
    assert res_wrong.status_code == 200
    assert res_wrong.json()["passed"] is False
    print("Game 1 Wrong PIN rejected as expected.")

    print("\n== 6. Game 1: Submit Correct PIN 615870 (Access Granted, Score <= 10.0, Unlocks Game 2) ==")
    res_correct = client.post(
        "/api/games/1/submit",
        json={"idempotency_key": "sub-correct-1", "final_code": "615870"},
        headers={"X-Team-ID": team_a_id}
    )
    assert res_correct.status_code == 200
    g1_data = res_correct.json()
    assert g1_data["passed"] is True
    assert g1_data["score_awarded"] <= 10.0
    assert g1_data["next_stage"] == 2
    print(f"Game 1 Cleared! Awarded Score: {g1_data['score_awarded']} pts (Max: 10.0). Next Stage: {g1_data['next_stage']}")

    print("\n== 7. Team Tokyo Dashboard after clearing Game 1 ==")
    res_dash2 = client.get("/api/progress/dashboard", headers={"X-Team-ID": team_a_id})
    dash2 = res_dash2.json()
    assert dash2["current_stage"] == 2
    assert dash2["stages"][0]["status"] == "COMPLETED"
    assert dash2["stages"][1]["status"] == "ACTIVE"
    print("Team Tokyo successfully transitioned to Stage 2!")

    print("\n== 8. Team Tokyo Skips Game 2 (Permanently Marked SKIPPED, Advances to Game 3) ==")
    res_skip = client.post("/api/progress/skip", json={"stage_id": 2}, headers={"X-Team-ID": team_a_id})
    assert res_skip.status_code == 200
    skip_data = res_skip.json()
    assert skip_data["status"] == "SKIPPED"
    assert skip_data["next_stage"] == 3
    print("Game 2 Skipped successfully. Advanced to Stage 3!")

    print("\n== 9. Leaderboard Check ==")
    res_lb = client.get("/api/leaderboard")
    assert res_lb.status_code == 200
    lb = res_lb.json()["leaderboard"]
    assert len(lb) >= 2
    print(f"Leaderboard verified! Total teams on board: {len(lb)}")
    for entry in lb:
        print(f"Rank {entry['rank']}: {entry['team_name']} - Current Stage: {entry['current_stage']} - Score: {entry['total_score']} pts")

    print("\n== 10. Admin Portal Verification ==")
    res_adm = client.get("/api/admin/teams", headers={"X-Admin-Token": "PROFESSOR_2026"})
    assert res_adm.status_code == 200
    teams_list = res_adm.json()["teams"]
    assert len(teams_list) >= 2
    print("Admin portal authenticated. Total live teams tracked:", len(teams_list))

    print("\nAll Backend Integration Tests PASSED with 100% SUCCESS!")

if __name__ == "__main__":
    test_unified_flow()
