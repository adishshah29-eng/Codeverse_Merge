# Problem 4 — Spreadsheet engine

`ui.py` is a finished pygame grid (scroll, click to select, type, Enter to commit).
It displays `sheet.get_value(ref)` for every cell. Today `engine.py` only stores text,
so typing `=A1*A0` just shows `=A1*A0`.

**Your job: write the formula engine in `engine.py`.** Read the docstring at the top of that
file — it is the full specification and the exact API the grader calls.

```
pip install pygame pytest
pytest -q test_engine.py      # public tests (a subset of the grader) — all red on arrival
python ui.py                  # try it by hand
```

The canonical cases:

```
A0 = 4        A1 = 3        A2 = =A1 * A0     -> 12
B1 = 2        B3 = 5        A3 = =B3 * B1     -> 10
=1+2*3 -> 7          set A0 = 5  =>  A2 becomes 15
A0 = =A1, A1 = =A0   =>  both show "#CYCLE" (no hang, no crash)
```

Grading is headless (no pygame): basic eval and precedence are the baseline, chained references and
propagation are the core, and **minimal topological recompute + cycle handling** is where the top teams separate.

## Submit
Submit your final `engine.py`.
