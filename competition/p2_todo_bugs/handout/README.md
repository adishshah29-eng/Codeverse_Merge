# Problem 2 — FastAPI TODO repo: bust the bugs

A complete FastAPI + SQLAlchemy (SQLite) TODO app. It starts and mostly works —
but **three bugs are planted** (one easy, one medium, one hard).

```
pip install -r requirements.txt
pytest -q          # some tests are red on arrival
```

## Your task
1. Make every test pass **without editing, deleting or skipping any test**.
2. Keep each fix **minimal** — do not rewrite unrelated code to paper over a bug.
3. For each bug write a **one-line root-cause note**: *why* it was wrong, not just what you changed.

## Submit
Upload the files you changed under `app/` (the tests are replaced by the originals
when we grade) and write one root-cause note per bug.

Scoring (6 points): 1 per bug fixed (its tests go green) + 1 per correct root-cause note.
