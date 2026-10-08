# CODEVERSE 2.0

One platform for both CODEVERSE competition phases:

| Phase | Name | Stages | Page |
| --- | --- | --- | --- |
| 1 | **Royal Mint Heist + Challenge Arena** | Stages 1–5: Vault Breach · Alarm System · Hidden Blueprint · Mint Map · Printing Press. Stages 6–10: URL Shortener · TODO API Bug Hunt · CTF Binary · Spreadsheet Engine · Linear Regression | `/phase1/` |
| 2 | **Operación Fuga** | Money Trail · Control Server · Outrun the Police · Final Extraction (+ Black Market) | `/phase2/` |

> **SQLite edition** (branch `claude/repo-work-wd3ehi-sqlite`): everything is stored in a single
> SQLite file on the server and team logins are handled by the backend itself — no Supabase or
> other external service is needed. The `claude/repo-work-wd3ehi` branch is the Supabase edition.

Teams sign in **once** on the landing page (`/`) and can open whichever phases the
organizers have opened. Game rules for players: [docs/PHASE1_GAME_GUIDE.md](docs/PHASE1_GAME_GUIDE.md),
[docs/PHASE2_GAME_GUIDE.md](docs/PHASE2_GAME_GUIDE.md).

This repository was created by merging
[CODEVERSE_PHASE1](https://github.com/adishshah29-eng/CODEVERSE_PHASE1) and
[CODEVERSE_PHASE2](https://github.com/adishshah29-eng/CODEVERSE_PHASE2) with full git history
(see the first merge commits; `git log --follow <file>` traces any file back to its original repo).

---

## Architecture

```text
 Browser ──HTTPS──► Cloudflare ──Tunnel──► cloudflared ──► Nginx :80 (Ubuntu)
                                                            │
                     /, /phase1/, /phase2/, /assets/  ◄─────┤  static React build (frontend/dist)
                     /vendor/                         ◄─────┤  static game assets (vendor/)
                     /api/*  ───────────────────────────────┘► Gunicorn + Uvicorn workers :8000 (FastAPI)
                                                                   │
                                          /var/lib/codeverse/codeverse.db  (SQLite, WAL mode)
```

* **Frontend** — one Vite build with three pages: the hub/login (`/`), Phase 1 and Phase 2.
  All API calls go to the same origin under `/api` (no hardcoded hosts).
* **Backend** — one FastAPI app. Phase 2 endpoints are at `/api/*`; Phase 1 endpoints are at
  `/api/phase1/*`. Shared: `/api/auth/*`, `/api/admin/*`, `/api/health`.
* **Database** — one SQLite file shared by all workers (WAL mode). Phase 1 tables are prefixed
  `p1_`. Tables are created automatically on first start; there is no schema to run by hand.
* **Auth** — organizers create team accounts (code, name, email, password) in the admin
  dashboard; passwords are stored as salted scrypt hashes. Login sets a signed httpOnly cookie.
  Organizers log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
* **Server-authoritative games** — all answers, timers, scores, penalties, hints, wallets and
  progression are stored and computed on the server. The client only sends attempts.

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app: routers, logging, errors, health, startup seeding
│   │   ├── settings.py         # all configuration (environment variables)
│   │   ├── auth.py             # session cookies (team + organizer)
│   │   ├── passwords.py        # scrypt password hashing
│   │   ├── phases.py           # which phases are open (active_phases)
│   │   ├── db.py, models.py    # SQLite via SQLAlchemy (Phase 2 + shared teams)
│   │   ├── routers/            # Phase 2 + shared endpoints  (/api/...)
│   │   ├── games/              # Phase 2 game engines
│   │   └── phase1/             # Phase 1  (/api/phase1/...)
│   │       ├── core/           #   config, SQLite store, progression, scoring
│   │       ├── games/          #   g1_vault_breach … g5_printing_press (stages 1-5), g1_url_shortener … g5_regression (stages 6-10), sandbox.py
│   │       ├── routers/        #   legacy_games.py (stages 1-5) + games.py (generic brief / handout / submit / finalize for 6-10)
│   │       ├── data/           #   stage 1-5 challenge data, ML datasets, private answer key
│   │       └── deps.py         #   maps the logged-in team to its Phase 1 record
│   ├── requirements.txt
│   ├── gunicorn.conf.py
│   └── .env.example
├── frontend/
│   ├── index.html              # /         hub + login
│   ├── phase1/index.html       # /phase1/
│   ├── phase2/index.html       # /phase2/
│   ├── src/
│   │   ├── hub/                # landing page
│   │   ├── phase1/             # Phase 1 React app (Tailwind)
│   │   ├── phase2/             # Phase 2 React app
│   │   └── shared/config.js    # API base URL
│   ├── public/                 # static images
│   ├── package.json, package-lock.json, vite.config.js
│   └── .env.example
├── vendor/                     # static mini-sites used by Phase 2 (market iframe, CTF pages)
├── competition/                # Phase 1 problem set: handouts (given to teams) + organizer/ (answer keys, hidden data)
├── deploy/
│   ├── nginx/codeverse.conf
│   ├── systemd/codeverse-backend.service, codeverse-backup.{service,timer}
│   ├── cloudflared/config.yml.example
│   └── apparmor/bwrap
├── scripts/
│   ├── dev-backend.sh, dev-frontend.sh
│   ├── backup-db.sh            # online SQLite backup
│   └── deploy.sh               # update an existing server deployment
└── docs/                       # player-facing game guides
```

## Configuration

All secrets live in **one backend environment file** and never reach the browser.
Template: [`backend/.env.example`](backend/.env.example) (every variable is documented there).

| Variable | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | prod | `production` enables strict startup checks (refuses to start if insecure) |
| `DATABASE_PATH` | prod | SQLite file; production `/var/lib/codeverse/codeverse.db` (default in dev: `backend/data/codeverse.db`) |
| `SECRET_KEY` | ✅ | ≥ 32 random chars; signs team and organizer sessions |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | ✅ | organizer login (password ≥ 12 chars in production) |
| `COOKIE_SECURE` | ✅ prod | `true` behind HTTPS |
| `STAGE1_DELETION_KEY`, `CTF_PUZZLE3_CODE`, `CTF_CONTROL_TOKEN`, `STAGE4_SHUTDOWN_CODE`, `STAGE4_SEQUENCE` | ✅ | Phase 2 answers (seeded on first start, editable in admin) |
| `CORS_ORIGINS` | no | leave empty (same-origin deployment) |
| `CODE_SANDBOX` | prod | `bwrap` in production (Phase 1 code isolation) |
| `CODE_EXEC_MAX_CONCURRENT`, `CODE_EXEC_QUEUE_TIMEOUT`, `CODE_EXEC_MEMORY_MB` | no | Phase 1 code-run limits |
| `SQLITE_BUSY_TIMEOUT_MS`, `GUNICORN_WORKERS` | no | capacity tuning |
| `LOG_LEVEL`, `ENABLE_DOCS` | no | logging; `/api/docs` (keep off in production) |

Frontend: [`frontend/.env.example`](frontend/.env.example) has a single, non-secret
`VITE_API_BASE_URL` (default `/api`). **Never** put secrets in any `VITE_*` variable — they are
compiled into public JavaScript.

## Run locally

Requirements: **Python 3.12** and **Node.js ≥ 20.19**. Nothing else — the database is a local file.
Works on Windows, macOS and Linux. Only this branch is downloaded with `--single-branch`.

**Windows (PowerShell)**

```powershell
git clone --single-branch -b claude/repo-work-wd3ehi-sqlite https://github.com/adishshah29-eng/Codeverse_Merge.git codeverse
cd codeverse\backend
copy .env.example .env          # then edit .env: SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Second PowerShell window:

```powershell
cd codeverse\frontend
npm ci
npm run dev                     # open http://localhost:5173
```

**macOS / Linux**

```bash
git clone --single-branch -b claude/repo-work-wd3ehi-sqlite https://github.com/adishshah29-eng/Codeverse_Merge.git codeverse
cd codeverse/backend
cp .env.example .env            # then edit .env: SECRET_KEY, ADMIN_USERNAME, ADMIN_PASSWORD
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Second terminal:

```bash
cd codeverse/frontend
npm ci
npm run dev                     # open http://localhost:5173
```

The Phase 2 answers in `.env` (`STAGE1_DELETION_KEY`, …) can be any test values locally.
On Windows and macOS, Phase 1 submitted code runs without the bubblewrap sandbox (Linux-only);
that is fine for testing, and production on Ubuntu uses the sandbox.

Shortcuts: `./scripts/dev-backend.sh` and `./scripts/dev-frontend.sh`.

Open http://localhost:5173, sign in as the organizer (`ADMIN_USERNAME` / `ADMIN_PASSWORD`),
open **Phase 2 → admin → TEAM ACCOUNTS** to create a team (code, name, email, password), then
sign in as that team. The database is created at `backend/data/codeverse.db`; delete that file
to start over.

Locally, `CODE_SANDBOX=auto` uses bubblewrap if installed (`sudo apt install bubblewrap`) and
otherwise runs Phase 1 code with resource limits only. Set `ENABLE_DOCS=true` to browse
`http://127.0.0.1:8000/api/docs`.

Production build check: `cd frontend && npm run build` (output in `frontend/dist`).

## Deploying on Ubuntu (when you are ready)

Target: Ubuntu 24.04 LTS with Nginx already installed; Cloudflare Tunnel in front; domain
`codeverse.is-a.dev`. Nothing in this repository deploys automatically — run these steps on the server.

### 1. System packages and user

```bash
sudo apt update
sudo apt install -y git python3 python3-venv bubblewrap nginx
# Node.js 20+ (Ubuntu's apt nodejs is too old for Vite):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

sudo useradd --system --home-dir /opt/codeverse --shell /usr/sbin/nologin codeverse
sudo mkdir -p /opt/codeverse
sudo chown codeverse:codeverse /opt/codeverse
```

### 2. Code, dependencies, build

```bash
sudo -u codeverse git clone -b claude/repo-work-wd3ehi-sqlite https://github.com/adishshah29-eng/Codeverse_Merge.git /opt/codeverse

cd /opt/codeverse
sudo -u codeverse python3 -m venv backend/.venv
sudo -u codeverse backend/.venv/bin/pip install --upgrade pip
sudo -u codeverse backend/.venv/bin/pip install -r backend/requirements.txt
sudo -u codeverse bash -c 'cd frontend && npm ci && npm run build'
```

(For a private repository, use a deploy key or a GitHub token for the clone.)

### 3. Secrets (root-only file)

```bash
sudo mkdir -p /etc/codeverse
sudo cp /opt/codeverse/backend/.env.example /etc/codeverse/backend.env
sudo nano /etc/codeverse/backend.env      # fill in every value; set:
#   ENVIRONMENT=production
#   DATABASE_PATH=/var/lib/codeverse/codeverse.db
#   COOKIE_SECURE=true
#   CODE_SANDBOX=bwrap
#   GUNICORN_WORKERS=5            (≈ 4 vCPU; see "Capacity")
sudo chown root:root /etc/codeverse/backend.env
sudo chmod 600 /etc/codeverse/backend.env
```

Generate `SECRET_KEY` with `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`.

### 4. Code sandbox check (Phase 1 code runs)

```bash
sudo -u codeverse bwrap --unshare-all --ro-bind / / true && echo "bubblewrap OK"
```

If it prints `setting up uid map: Permission denied`, Ubuntu's AppArmor user-namespace
restriction is blocking bubblewrap. Allow it for `/usr/bin/bwrap` only:

```bash
sudo cp /opt/codeverse/deploy/apparmor/bwrap /etc/apparmor.d/bwrap
sudo apparmor_parser -r /etc/apparmor.d/bwrap
sudo -u codeverse bwrap --unshare-all --ro-bind / / true && echo "bubblewrap OK"
```

### 5. Backend service

```bash
sudo cp /opt/codeverse/deploy/systemd/codeverse-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now codeverse-backend
sudo systemctl status codeverse-backend
curl -s http://127.0.0.1:8000/api/health/ready      # {"status":"ready","database":"connected"}
sudo ls -l /var/lib/codeverse/                       # codeverse.db (owner codeverse, mode 600)
journalctl -u codeverse-backend -n 50 --no-pager      # look for "bubblewrap isolation active"
```

### 6. Nginx

```bash
sudo cp /opt/codeverse/deploy/nginx/codeverse.conf /etc/nginx/sites-available/codeverse
sudo ln -sf /etc/nginx/sites-available/codeverse /etc/nginx/sites-enabled/codeverse
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
curl -s http://127.0.0.1/api/health                  # through Nginx
```

Nginx (user `www-data`) must be able to read `/opt/codeverse/frontend/dist` and
`/opt/codeverse/vendor`; the default 755 permissions allow this.

### 7. Cloudflare Tunnel

```bash
# Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
cloudflared tunnel login
cloudflared tunnel create codeverse                  # note the tunnel UUID
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/<TUNNEL-UUID>.json /etc/cloudflared/
sudo cp /opt/codeverse/deploy/cloudflared/config.yml.example /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml                # put in the tunnel UUID
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

DNS: `codeverse.is-a.dev` must point to `<TUNNEL-UUID>.cfargotunnel.com`. The `is-a.dev` zone is
not in your Cloudflare account, so confirm with is-a.dev how to do this (a CNAME to a tunnel in
another Cloudflare account may be refused with error 1014; NS delegation of the subdomain to your
own Cloudflare account avoids that). Only the tunnel should reach the server — no inbound ports
need to be open.

### 8. Database backups

```bash
sudo install -d -o codeverse -g codeverse -m 700 /var/backups/codeverse
sudo cp /opt/codeverse/deploy/systemd/codeverse-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now codeverse-backup.timer
sudo systemctl start codeverse-backup.service && ls -l /var/backups/codeverse   # first backup
```

A consistent snapshot is taken every 10 minutes while the app runs (the newest 48 are kept).
Copy them off the server too (e.g. `scp`/`rsync` after the event). To restore:
stop the backend, replace `/var/lib/codeverse/codeverse.db` with a backup (owner `codeverse`,
mode 600), delete any `codeverse.db-wal` / `codeverse.db-shm`, start the backend.

### 9. Updating later

```bash
cd /opt/codeverse
sudo -u codeverse ./scripts/deploy.sh
sudo systemctl restart codeverse-backend
```

The database is outside the repository, so updates never touch event data.

## Operating the event

* **Health:** `GET /api/health` (process up), `GET /api/health/ready` (database reachable).
* **Logs:** `journalctl -u codeverse-backend -f` — one line per API request with status, time and
  request id; errors include a stack trace server-side only (clients get a generic 500 + request id).
* **Opening / closing phases:** organizer → Phase 2 admin → configuration → `active_phases`
  = `1`, `2` or `1,2`. Takes effect within ~5 seconds. Admin pages are never gated.
* **Teams:** create accounts once in Phase 2 admin → TEAM ACCOUNTS (code, name, email, password).
  A team's Phase 1 record is created automatically the first time it opens Phase 1. Deleting a team
  removes it from both phases. To change a team's password, delete and re-create the account
  before the event starts (deleting removes its progress).

### Capacity (300–400 concurrent players)

* Suggested server: 4 vCPU / 8 GB RAM, SSD storage, `GUNICORN_WORKERS=5`.
* SQLite runs in WAL mode: reads never wait; writes are serialized but each takes milliseconds.
  Data-changing requests take the write lock at the start of their transaction and queue for up to
  `SQLITE_BUSY_TIMEOUT_MS` (15 s) — if that is ever exceeded the API returns `503 busy, retry`.
  Measured on a 4-core test machine (3 workers, load generator on the same machine): 300 teams
  logging in and then firing ~2,100 mixed game requests at the same instant all succeeded with no
  lock errors; server-side handling averaged 25–90 ms per request.
* Logins are deliberately CPU-heavy (scrypt). 300 simultaneous logins take ~10 s in total; in
  practice logins are spread out.
* Phase 1 grading runs (URL Shortener load test, TODO pytest run, spreadsheet and regression graders) are CPU-heavy: at most
  `GUNICORN_WORKERS × CODE_EXEC_MAX_CONCURRENT` run at once (default 5 × 2 = 10); extra
  requests wait up to `CODE_EXEC_QUEUE_TIMEOUT` seconds and then get a "busy, try again" message.
* Keep the database on local disk (not NFS/network storage) — SQLite locking requires it.
* This edition runs on **one server**. To scale across several servers, use the Supabase edition.

## Security model

* No secrets in the repository or the frontend bundle; `.env` files and databases are git-ignored.
* The database file (`/var/lib/codeverse`, mode 700/600) is readable only by the service user;
  the secrets file `/etc/codeverse/backend.env` only by root (systemd loads it).
* Team passwords are stored as salted scrypt hashes; login takes the same time whether or not the
  email exists. Sessions are signed (HS256, `SECRET_KEY`) httpOnly cookies that expire after 18 h.
* The Phase 2 Stage 1 SQL console uses a separate read-only connection with an SQLite authorizer
  that allows `SELECT` on the five forensic tables only — no other tables (answers, teams,
  password hashes), no `ATTACH`, `PRAGMA` or writes — plus a 5-second time limit.
* Phase 1 submitted Python runs in a bubblewrap sandbox: no network, no secrets in its environment,
  no view of the application code, `.env`, database or answer key, with CPU/memory/file limits.
* Team identity always comes from the verified session cookie; client-supplied team ids, scores,
  times and answers are never trusted. Wrong answers do not reveal the correct one.
* Phase 2 submission endpoints keep their per-team cooldown (`submission_cooldown_seconds`).
