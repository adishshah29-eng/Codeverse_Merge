# CODEVERSE 2.0 | Royal Mint Heist

**A five-stage team cyber-heist challenge.** Investigate intercepted evidence, debug security code, reverse-engineer a hidden archive, plot a safe escape, and train a machine-learning model before the final press run.

> This guide explains the game mechanics without publishing solution codes or the server-side answer key.

## At A Glance

| Stage | Challenge | What you do to clear it |
| --- | --- | --- |
| 01 | **Vault Breach** | Correlate the evidence, apply the digit shift, and enter the six-digit PIN. |
| 02 | **Alarm System** | Repair one of three Python data-science routines and pass its disarm check. |
| 03 | **Hidden Blueprint** | Investigate the in-game DevTools clues and submit the recovered extraction code. |
| 04 | **The Leak + Mint Map** | Find a connected route through the mint that satisfies every patrol window. |
| 05 | **Printing Press** | Train a regression model and benchmark exactly 1,500 test predictions. |

Each stage is worth up to 10 points. Completing all five stages gives a 50-point maximum. Time, failed submissions, hints, route quality, and model error can affect awarded points.

```mermaid
flowchart LR
    A[01 Vault Breach] --> B[02 Alarm System]
    B --> C[03 Hidden Blueprint]
    C --> D[04 Mint Map]
    D --> E[05 Printing Press]
    E --> F[Mission Complete]
```

## Play The Campaign

### 1. Vault Breach

1. Register a team or log in with the team name and passcode.
2. Read the intercepted dossier. Use the evidence to identify the door, witness, metal lot, and shift described by the briefing.
3. Use the **Caesar Digit Shift Terminal** to apply the shift to the extracted values. The digit wheel wraps modulo 10.
4. Enter the resulting six digits on the keypad and choose **Open**.

The evidence is the puzzle. A failed PIN does not advance the campaign.

### 2. Alarm System

1. Select one of the three alarm subroutines: NumPy telemetry normalization, Pandas rolling VWAP, or scikit-learn classifier calibration.
2. Inspect the starter code and the challenge description, then repair its defects in the editor.
3. Choose **Run Test** to see standard output and errors in the console. **Reset** restores the selected starter code.
4. When the output satisfies the disarm check, choose **Neutralize** to record the result.

The three routines are alternatives; clearing one successfully advances the stage. Test runs are for iteration; the successful **Neutralize** submission is what records completion.

### 3. Hidden Blueprint

Use the built-in inspector as a small web-forensics workstation:

1. In **Elements & DOM**, inspect the archive markup and its hidden clues.
2. In **Styles (CSS)**, use the override control to reveal the archive relay.
3. In **Network (API)**, inspect the ping, manifest, and press records. Follow the artifacts and their references between panels.
4. In **LocalStorage**, inspect the archived key-value data for the fragment needed by the blueprint query.
5. Query the fragment, then submit the recovered extraction code.

The panels simulate the investigation workflow; you do not need to open your browser's real developer tools.

### 4. The Leak + Mint Map

1. Start at Chamber 0. Click a directly connected chamber to extend the route; the graph shows corridor travel times and each chamber's patrol window.
2. Reach Chamber 20 without revisiting a chamber. Routes must follow connected corridors.
3. Read the live telemetry: arrival time must fall inside every visited chamber's displayed window. The score cost is **risk + 2 × time**, so a legal lower-cost route scores better.
4. Use **Reset Path** to start again. Once the route is legal, choose **Confirm & Execute Infiltration**.

The evaluator reports patrol-window failures and the risk, time, and cost for the current route before submission.

### 5. Printing Press

1. Review the dataset information and starter model in the editor. The runtime provides `train_df` and `test_df`; the target column is `amount_printed`.
2. Train using the labeled training rows and assign predictions for the test rows to a variable named `predictions`.
3. Ensure `predictions` contains exactly **1,500 finite numeric values**. NaN and infinite values are rejected.
4. Choose **Test Run** to check execution and inspect any output or plot. Choose **Submit for Benchmark** to score the model against the private server-side answer key.

The benchmark scores prediction accuracy; its answer key is not included in the public game data.

## Team Progress And Scoring

- Use the dashboard to view stage state, score, attempts, hints, elapsed time, and team rank.
- The leaderboard ranks active teams. The final screen shows the campaign score out of 50.
- Hints and failed attempts can reduce points. The exact scoring rules are administrator-configurable.
- Skipping a stage permanently marks it skipped and advances the team. A skipped stage cannot be replayed through normal progression; skip points and penalties depend on the current configuration.
- Team progress is stored in Supabase. The browser keeps the team's session identifier so the team can return on the same browser.

## Run Locally

### Requirements

- Python 3.10 or newer
- Node.js and npm (use a version supported by the installed Vite release)
- A Supabase project and a server-side service-role key

### 1. Configure Supabase

Run [`backend/supabase_schema.sql`](backend/supabase_schema.sql) in the Supabase SQL Editor. It creates the tables, enables row-level security without public policies, and grants the attempt-counter RPC only to `service_role`.

Create `backend/.env` with your own values:

```dotenv
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<server-side-service-role-key>
ADMIN_PASSCODE=<strong-admin-passcode>
SECRET_KEY=<long-random-secret>
```

Never put the Supabase service-role key in `frontend/.env` or any `VITE_*` variable. The project-root `.gitignore` excludes local `.env` files.

### 2. Install And Start The Backend

In a PowerShell terminal from the project root:

```powershell
cd backend
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API is at `http://localhost:8000`, its health endpoint is `http://localhost:8000/health`, and interactive API docs are at `http://localhost:8000/docs`.

### 3. Install And Start The Frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
npm run dev
```

Vite serves the app at `http://localhost:5173`. The frontend defaults to `http://localhost:8000/api`; to change it, create `frontend/.env` with:

```dotenv
VITE_API_URL=http://localhost:8000/api
```

### Optional: Import A Legacy SQLite Database

If you have an older `backend/data/heist_unified.db`, first confirm the source row counts, then import after the Supabase schema is installed and credentials are configured:

```powershell
python backend/migrate_sqlite_to_supabase.py --dry-run
python backend/migrate_sqlite_to_supabase.py
```

The importer upserts teams, stage progress, submissions, audit logs, and scoring configuration. It does not delete the SQLite source. If the legacy database is absent, skip this step.

## Admin And API

Choose **Admin** on the entry screen and authenticate with the configured `ADMIN_PASSCODE`. The admin portal can monitor teams, manage team access, reset progress, update scoring configuration, and inspect audit logs. Change the passcode from any development default before using the portal outside a local environment.

The FastAPI documentation at `/docs` lists the full endpoint set. All game and progression endpoints are under `/api`.

## Project Layout

```text
MINT/
├── backend/
│   ├── core/          # Configuration, Supabase access, progression, scoring
│   ├── games/         # Server-side game rules and evaluation
│   ├── routers/       # FastAPI routes
│   ├── data/          # Public challenge data and ML datasets
│   └── supabase_schema.sql
└── frontend/
    └── src/
        ├── components/ # Authentication, dashboard, leaderboard, admin
        └── games/      # The five interactive stages
```

## Deployment Notes

- Keep the Supabase service-role key, admin passcode, and secret key on the backend only. Rotate credentials that have been shared or committed.
- The backend executes submitted Python code for the debugging and ML stages in subprocesses with time limits. A timeout is not a security sandbox; isolate code execution before exposing this service to untrusted public traffic.
- The current FastAPI configuration allows requests from all origins. Restrict CORS to the deployed frontend origin before production use.
- Use a separate Supabase project or disposable test data for integration tests; the backend test flow creates and changes team records.