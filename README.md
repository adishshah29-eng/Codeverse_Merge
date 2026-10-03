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
* **Output:** `Deletion Key` (`ERASE-7429`).
* **Scoring:** Max 10.0 PTS.

### Stage 2: Find the Control Server
* **Category:** Web & API Forensics (IronVault CTF)
* **Challenge:** 3 Security Sectors:
  1. *Teller Login:* SQL injection tautology (`' OR '1'='1`) bypassing character filters.
  2. *Institutional Transfers:* DOM overlay bypass (`div.fraud-shield`).
  3. *Vault Balance Audit:* HTTP response header extraction (`X-Audit-Code`).
* **Output:** `Control Token` (`MINT-OMEGA`).
* **Scoring:** Max 10.0 PTS.

### Stage 3: Outrun the Police
* **Category:** Graph Algorithms & Multi-Objective Optimization
* **Challenge:** 60-checkpoint city escape graph with closing availability windows and compromised nodes. Must satisfy time deadline (≤ 120 min) and resource budget (≤ 100 credits) while minimizing risk.
* **Output:** `Escape Route Code` (checksum, e.g. `EDA1-2D02` or `NORTH-07`).
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

Team access uses Supabase Auth. There are no seeded team accounts or shared passwords.

The ignored `backend/heist.db` file is the local SQLite game database. `supabase/schema.sql` is not another database; it creates the game tables in PostgreSQL. The app can use Supabase Auth with a local SQLite game DB, or use Supabase PostgreSQL for both Auth and game data.

1. Copy `backend/.env.example` to `backend/.env` and fill in the Supabase project URL and anon key. Set `DATABASE_URL` to the PostgreSQL connection string if using Supabase PostgreSQL, then apply `supabase/schema.sql` in that database. To keep local SQLite, omit `DATABASE_URL` or set it to the default SQLite path.
2. Create each crew account in Supabase Auth and copy its user UUID.
3. Provision a corresponding team row in the selected game database, assigning that UUID to `supabase_user_id`:

```sql
INSERT INTO teams (code, name, supabase_user_id, money, current_stage)
VALUES ('TEAM01', 'Alpha Crew', '<supabase-auth-user-uuid>', 10000, 1);
```

The API resolves the team from the verified Supabase user ID; it ignores team identity supplied by the browser. Set `COOKIE_SECURE=true` when serving over HTTPS. Organizer credentials remain configured with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. Restart the backend after creating or changing `.env`.
