# CODEVERSE 2.0 | Phase 1 — Royal Mint Heist + Challenge Arena

**Ten stages in strict order.** Stages 01–05 are the Royal Mint Heist (vault breach, alarm debugging, hidden blueprint, mint map, printing-press ML); stages 06–10 are the Challenge Arena: five engineering challenges, one per muscle — optimization, debugging, reverse engineering, parsing/graphs and ML diagnosis.
Each Challenge Arena problem gives you a **handout** (the files are listed and readable right on the stage page — copy them, save them one by one, or load them straight into the editor), you work on your own machine, and you **submit** your
result on the platform, where it is graded automatically.

> This guide explains the mechanics. Answer keys and hidden tests stay on the server.

## At a glance

### Royal Mint Heist (stages 01–05)

| Stage | Challenge | What you do to clear it |
| --- | --- | --- |
| 01 | **Vault Breach** | Correlate the evidence, apply the digit shift, and enter the six-digit PIN. |
| 02 | **Alarm System** | Repair one of three Python data-science routines and pass its disarm check. |
| 03 | **Hidden Blueprint** | Investigate the in-game DevTools clues and submit the recovered extraction code. |
| 04 | **The Leak + Mint Map** | Find a connected route through the mint that satisfies every patrol window. |
| 05 | **Printing Press** | Train a regression model and benchmark exactly 1,500 test predictions. |

Time, failed submissions, hints, route quality and model error affect these scores.

### Challenge Arena (stages 06–10)

| Stage | Challenge | You get | You submit |
| --- | --- | --- | --- |
| 06 | **URL Shortener** — make the slow one fast | a working but deliberately slow service, behaviour tests, a load test | your optimised `shortener.py` (+ a note on the bottlenecks) |
| 07 | **TODO API bug hunt** | a FastAPI + SQLAlchemy app with 3 planted bugs and a pytest suite | the files you changed under `app/` + a root-cause note per bug |
| 08 | **CTF** — pull the password out of the binary | `stage1` and a bonus obfuscated `stage1_xor` (Linux x86-64) | the password, the flag, a method note (+ bonus answers) |
| 09 | **Spreadsheet engine** | a finished pygame grid and an `engine.py` stub | your `engine.py` (formulas, references, cycles) |
| 10 | **Linear regression** — the model that lies | `housing.csv`, `housing_test.csv`, `starter.py` | `solution.py` with `fit_predict` and a `report` |

Every stage is worth up to **10 points** (100 total). Stages unlock in order.

## How scoring works

* **Organizers can switch games off.** A game that is switched off cannot be played and is left out of every team's total; the "out of" maximum shrinks to match (10 points per game that is on). Scores are kept, so switching a game back on restores them.
* **Partial credit.** Submit as often as you like (there is a few-seconds cooldown). The platform keeps your **best** grade.
* **Perfect = automatic completion.** When nothing more can be earned the stage completes and the next one unlocks.
* **Not perfect?** Press **Lock in score & continue** to bank your best grade and move on (you cannot return), or keep improving.
* **Deductions.** Each hint costs points (−0.5 / −1.0 / −1.5). Stage 08 (CTF) also charges −0.25 per wrong answer — don't guess.
* **Skip** (from the Dashboard) gives 0 points for the stage and unlocks the next.
* Your running score is on the leaderboard while a stage is open, so every point you bank counts immediately.

## Challenge Arena stage details

### 06 — URL Shortener (Systems / optimization)
`POST /shorten` returns a short code, `GET /{code}` redirects (301). It works, but it re-reads a JSON file on every request,
scans every stored URL for duplicates and for code collisions. Profile it, fix the bottlenecks and keep behaviour identical.
Graded: correctness gate (2) · speedup vs. the baseline, full marks at 20× (6) · an LRU cache on the read path (1) · a note naming the bottlenecks (1).

### 07 — TODO API bug hunt (Debugging)
Run `pytest`; four tests are red. Find the three bugs (easy → medium → hard), fix them minimally, never edit the tests, and
write a one-line **root cause** for each — *why* it was wrong. Graded: 1 point per bug fixed + 1 per correct root-cause note (6, scaled to 10);
tests that were green and break again cost points. The hard bug returns success and still loses data — read the next request, not the response.

### 08 — CTF (Security / reverse engineering)
The password is inside `stage1`. Recover it statically (`strings`, Ghidra, `objdump`) or dynamically (`ltrace`, `gdb`) — no brute force.
Submit the password, the flag and how you did it. Bonus: `stage1_xor` hides everything behind XOR; `strings` won't help.
Only run binaries on a machine you own (WSL / VM / Docker).

### 09 — Spreadsheet engine (Parsing / graphs)
Write the engine behind the grid: `=` formulas with `+ - * /`, parentheses, numbers and references (`A0`, `B3`); chained references;
recompute **only what is downstream** of a change, in topological order; show `#CYCLE` for reference cycles. The docstring of `engine.py` is the full spec.
Graded headlessly by tier: baseline (eval + precedence) · core (chains + propagation) · hard (minimal recompute + cycles).

### 10 — Linear regression (ML / diagnosis)
A naive `LinearRegression` looks great on training data and falls apart on test. Find out why *before* you fix it: residual plots, VIF, train/test gap.
Fix every trap, keep the coefficients explainable in a sentence, and report one line per trap naming the diagnostic that caught it.
Graded on a hidden holdout over 5 resampled seeds — stability matters.

```mermaid
flowchart LR
    A[01 Vault Breach] --> B[02 Alarm System] --> C[03 Hidden Blueprint] --> D[04 Mint Map] --> E[05 Printing Press]
    E --> F[06 URL Shortener] --> G[07 TODO bug hunt] --> H[08 CTF] --> I[09 Spreadsheet] --> J[10 Regression]
    J --> K[Phase 1 complete]
```
