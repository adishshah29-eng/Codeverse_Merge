# Problem 2 — Answer key (organizer only; never hand out)

| Tier | File | Bug | Fix | Root cause |
|---|---|---|---|---|
| Easy | `app/main.py` | `POST /todos` has no `status_code=201`, so FastAPI defaults to 200 | `@app.post("/todos", ..., status_code=201)` | Creating a resource must answer 201 Created; the decorator's default is 200 |
| Medium | `app/crud.py` `list_todos` | `start = max(skip - 1, 0)` → every page after the first starts one row early, so the last row of the previous page repeats | `.offset(skip)` | `skip` already counts rows to skip; it is a count, not a 1-based position, so subtracting 1 is an off-by-one |
| Hard | `app/crud.py` `complete_todo` | `db.flush()` instead of `db.commit()` | `db.commit()` | flush only sends SQL inside the open transaction; `get_db` closes the session without committing so the change is rolled back — the response looks right (the object in memory is updated) but the next request reads the old row |

Failing tests on arrival (4): `test_create_returns_201_and_body` (easy), `test_pagination_*` (2, medium),
`test_complete_is_persisted_across_requests` (hard). Verified: with `solution/app` all 10 tests pass.
`test_empty_title_rejected` is a regression guard that already passes (the schema validates it).

Scoring: 1 per bug fixed + 1 per root-cause note = 6. The platform grader auto-scores notes by keywords
(see `backend/app/phase1/games/g2_todo_bugs.py`) and stores the raw notes for manual review.
