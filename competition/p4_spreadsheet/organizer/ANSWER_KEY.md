# Problem 4 — Organizer notes

* `handout/`: `ui.py` (pygame grid, finished), `engine.py` (stub that stores text), `test_engine.py` (public subset).
* `organizer/solution_engine.py`: reference engine (22/22). `organizer/grade_engine.py`: the headless grader —
  `python grade_engine.py path/to/engine.py` prints JSON; the platform runs it in a sandbox.
* Weights: baseline 10, core 18, hard 19 (total 47) → scaled to the stage's 10 points.
* Approach: tokenizer → recursive-descent parser → AST; dependency graph (`_deps`/`_users`); on change, collect the
  transitive dependents, run Kahn's algorithm on that sub-graph, evaluate in order; cells never reaching in-degree 0 are
  on/behind a cycle → `#CYCLE`. `eval_count` proves only downstream cells re-evaluate.
* UI smoke test: `SDL_VIDEODRIVER=dummy python organizer/ui_smoke.py`.
