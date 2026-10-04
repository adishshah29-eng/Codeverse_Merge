# 🎭 CODEVERSE 2.0 // Unified Heist Game Platform

A unified, full-stack cybersecurity and optimization competition platform integrating five independent challenges into one coherent, cinematic experience.

---

## 🗺️ System Architecture

```text
                        ┌──────────────────────────────────────────────┐
                        │              REACT VITE SPA                  │
                        │  Dashboard • Stages 1-4 • Black Market • HUD │
                        └──────────────────────┬───────────────────────┘
                                               │ HTTP / REST
                                               ▼
                        ┌──────────────────────────────────────────────┐
                        │          FASTAPI CENTRAL BACKEND             │
                        │  Auth • Progression • Penalties • Telemetry  │
                        └──────┬───────────────────────────────┬───────┘
                               │                               │
                ┌──────────────┴──────────────┐  ┌─────────────┴─────────────┐
                │     SUPABASE / SQLITE       │  │       GAME ENGINES        │
                │ Teams, Progress, Ledgers,   │  │ 1. Forensics / SQL        │
                │ Game Outputs, Audit Events  │  │ 2. CTF Sectors (SQLi/DOM) │
                └─────────────────────────────┘  │ 3. Police Routing (DP)    │
                                                 │ 4. 3D Extraction (ThreeJS)│
                                                 │ 5. Black Market Economy   │
                                                 └───────────────────────────┘
```

---

## 🎮 The Five Games & Narrative Flow

### Stage 1: Erase the Money Trail
* **Category:** Data Forensics & SQL / Pandas
* **Challenge:** Query transactions, employee badges, terminal sessions, and security events to trace an unauthorized server room breach and corrupt wire transfer.
* **Output:** Team-specific Deletion Key.
* **Scoring:** Max 10.0 PTS.

### Stage 2: Find the Control Server
* **Category:** Web & API Forensics (IronVault CTF)
* **Challenge:** 3 Security Sectors:
  1. *Teller Login:* SQL injection tautology bypassing character filters.
  2. *Institutional Transfers:* DOM overlay bypass (`div.fraud-shield`).
  3. *Vault Balance Audit:* HTTP response header extraction (`X-Audit-Code`).
* **Output:** Control Token stored for server-side extraction verification.
* **Scoring:** Max 10.0 PTS.

### Stage 3: Outrun the Police
* **Category:** Graph Algorithms & Multi-Objective Optimization
* **Challenge:** 60-checkpoint city escape graph with closing availability windows and compromised nodes. Must satisfy time deadline (≤ 120 min) and resource budget (≤ 100 credits) while minimizing risk.
* **Output:** Escape Route Code stored for server-side extraction verification.
* **Scoring:** Max 10.0 PTS.

### Stage 4: Final Extraction
* **Category:** Systems Integration & 3D Getaway
* **Challenge:** Authenticate all 4 prerequisite credentials (`Deletion Key`, `Shutdown Code`, `Control Token`, `Route Code`), execute the 5-step override sequence puzzle (`surveillance` → `alarm` → `locks` → `passage` → `crew`), and pilot the getaway crew through the underground transit tunnels.
* **Output:** Extraction Cinematic + Authoritative Final Heist Score.
* **Scoring:** Max 10.0 PTS + overall event score.

### Parallel System: The Black Market
* **Category:** Shadow Risk / Reward Economy
* **Features:**
  * Runs independently in parallel without blocking main progression.
  * **Team-Specific Price Inflation:** Each purchase by a team inflates future prices *only for that team* (`+25%` per purchase), ensuring zero cross-team price interference.
  * Features tactical buffs, stage hints, mystery contraband, and a Cursor-Torch investigation canvas.

---

## ⚡ Key Game Rules & Controls

1. **Stage Scores:** Max **10.0 points** per challenge.
2. **Stage Skipping:** Teams can skip any stage. Skipping applies a configurable penalty (default: `-3.0 PTS`), permanently marks the stage as skipped, and allows moving forward.
3. **Dynamic Hints:** Organizers can release/enable hints in real-time from the Organizer Panel. Requesting a hint deducts configurable points.
4. **Authoritative Server Validation:** Zero trust in client calculations. All timers, wallets, scores, penalties, and outputs are enforced by FastAPI.

---

## 🚀 Running Locally

### 1. Start the FastAPI Backend
```powershell
cd heist-game/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the React Frontend
```powershell
cd heist-game/frontend
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## Supabase Auth Setup

Team access uses Supabase Auth. Organizers can create and delete team accounts in the admin dashboard.

The ignored `backend/heist.db` file is the local SQLite game database. `supabase/schema.sql` is not another database; it creates the game tables in PostgreSQL. The app can use Supabase Auth with a local SQLite game DB, or use Supabase PostgreSQL for both Auth and game data.

1. Copy `backend/.env.example` to `backend/.env` and fill in the Supabase project URL, anon key, and service-role key. The service-role key is required for team account management; keep it private and only in the backend environment. Set `DATABASE_URL` to the PostgreSQL connection string if using Supabase PostgreSQL, then apply `supabase/schema.sql` in that database. To keep local SQLite, omit `DATABASE_URL` or set it to the default SQLite path.
2. Sign into the organizer portal and use **TEAM ACCOUNTS** to enter a team code, name, login email, and password. Give the team its login email and password.
3. Team records are created in the selected game database and linked to their Supabase Auth user automatically.

Set `STAGE1_DELETION_KEY`, `CTF_PUZZLE3_CODE`, `CTF_CONTROL_TOKEN`, `STAGE4_SHUTDOWN_CODE`, and `STAGE4_SEQUENCE` in the private backend `.env` before first startup. The game seeds these values into `ConfigKV`; organizers can change them later in the admin configuration panel. Never place event answers in frontend code or public documentation.

The API resolves the team from the verified Supabase user ID; it ignores team identity supplied by the browser. Deleting a team removes its Supabase Auth account and game progress while retaining detached audit events. Set `COOKIE_SECURE=true` when serving over HTTPS. Organizer credentials remain configured with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Restart the backend after creating or changing `.env`.
