# Phase 1 problem set — five challenges

Each problem folder has the same layout:

```
pNN_name/
  handout/     what teams receive (the platform zips this folder for the stage page — never put answers here)
  organizer/   answer key, reference solution, graders, hidden data (server-side only)
```

| # | Folder | Domain | Handout | Reference answer | Platform grader |
|---|---|---|---|---|---|
| 1 | `p1_url_shortener` | Systems / optimization | slow `shortener.py`, `test_correctness.py`, `loadtest.py` | `organizer/solution_shortener.py` (≈95× faster) | `backend/app/phase1/games/g1_url_shortener.py` |
| 2 | `p2_todo_bugs` | Debugging | full FastAPI app (3 planted bugs) + pytest suite | `organizer/solution/app/`, `ANSWER_KEY.md` | `g2_todo_bugs.py` |
| 3 | `p3_ctf` | Security / reversing | `stage1`, `stage1_xor` binaries | `organizer/ANSWER_KEY.md`, C sources, `build.sh` | `g3_ctf.py` |
| 4 | `p4_spreadsheet` | Parsing / graphs | pygame grid UI + `engine.py` stub + public tests | `organizer/solution_engine.py`, `grade_engine.py` | `g4_spreadsheet.py` |
| 5 | `p5_regression` | ML / diagnosis | `housing.csv`, `housing_test.csv`, `starter.py` | `organizer/solution.py`, `gen_housing.py`, `ANSWER_KEY.md` | `g5_regression.py` |

**Keep `organizer/` private.** If you share this repository with participants, move the `organizer/` folders out first
— the grading server reads them from `competition/*/organizer/`, so keep them on the server only (e.g. hand teams just the `handout/` folders or the zips from the stage pages).

## What is verified

* P1 — the reference solution passes all 7 behaviour tests and is ~95× faster than the baseline; the baseline scores 2.2/10, a behaviour-breaking edit scores 0.
* P2 — the handout has exactly 4 red tests (3 bugs); the reference fix turns all 10 green. Platform: reference = 10/10, fixing only the hard bug = 3.3/10.
* P3 — both binaries print the flag for `r3v3rs3_m3_pls`; `strings` shows the flag for `stage1` and nothing for `stage1_xor`.
* P4 — the reference engine passes 22/22 grader cases (the stub passes 0); `organizer/ui_smoke.py` drives the pygame UI headlessly.
* P5 — the naive model scores train R² 0.94 / test R² 0.27; the reference fix scores ≈ 0.97 on the hidden holdout; partial fixes score in between.
* End to end — `backend/tests/test_phase1_challenges.py` plays all five stages through the real API (login → hints → submit → finalize → leaderboard).

## Regenerating data / binaries

* `python3 p5_regression/organizer/gen_housing.py` — rewrites `housing.csv`, `housing_test.csv` and the hidden holdout (seeded, deterministic).
* `p3_ctf/organizer/build.sh` — rebuilds both binaries. If you change the password/flag set `PHASE1_CTF_PASSWORD` / `PHASE1_CTF_FLAG` on the server.
* `PHASE1_URL_LOAD_N` (default 2000) and `PHASE1_URL_BASELINE_SECONDS` tune/pin the URL-shortener load test.

## Running the checks yourself

```
cd backend && python -m pytest tests -q                 # full platform flow (~50 s, includes sandboxed grading)
cd competition/p2_todo_bugs/handout && pytest -q        # 4 red on arrival
cd competition/p4_spreadsheet/organizer && python grade_engine.py solution_engine.py
```
