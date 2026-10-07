# CODEVERSE 2.0

One platform for both CODEVERSE competition phases:

| Phase | Name | Stages | Page |
| --- | --- | --- | --- |
| 1 | **Royal Mint Heist** | Vault Breach · Alarm System · Hidden Blueprint · Mint Map · Printing Press | `/phase1/` |
| 2 | **Operación Fuga** | Money Trail · Control Server · Outrun the Police · Final Extraction (+ Black Market) | `/phase2/` |

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
                                                  Supabase Cloud ◄─┘  Auth (team logins) + Postgres (all data)
```

* **Frontend** — one Vite build with three pages: the hub/login (`/`), Phase 1 and Phase 2.
  All API calls go to the same origin under `/api` (no hardcoded hosts).
* **Backend** — one FastAPI app. Phase 2 endpoints are at `/api/*` (unchanged); Phase 1
  endpoints are at `/api/phase1/*`. Shared: `/api/auth/*`, `/api/admin/*`, `/api/health`.
* **Auth** — teams log in with their Supabase Auth email + password through the backend, which
  sets an httpOnly cookie. Organizers log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
  The browser never sees any Supabase key.
* **Server-authoritative games** — all answers, timers, scores, penalties, hints, wallets and
  progression are stored and computed on the server. The client only sends attempts.

## Project structure

```text
.
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI app: routers, logging, errors, health, startup seeding
│   │   ├── settings.py         # all configuration (environment variables)
│   │   ├── auth.py             # session verification (Supabase JWT / admin JWT)
│   │   ├── phases.py           # which phases are open (active_phases)
│   │   ├── db.py, models.py    # SQLAlchemy (Phase 2 + shared teams)
│   │   ├── routers/            # Phase 2 + shared endpoints  (/api/...)
│   │   ├── games/              # Phase 2 game engines
│   │   └── phase1/             # Phase 1  (/api/phase1/...)
│   │       ├── core/           #   config, Supabase REST access, progression, scoring
│   │       ├── games/          #   game rules + sandbox.py (isolated code execution)
│   │       ├── routers/        #   endpoints
│   │       ├── data/           #   challenge data, ML datasets, private answer key
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
├── supabase/schema.sql         # complete database schema (run once)
├── vendor/                     # static mini-sites used by Phase 2 (market iframe, CTF pages)
├── deploy/
│   ├── nginx/codeverse.conf
│   ├── systemd/codeverse-backend.service
│   ├── cloudflared/config.yml.example
│   └── apparmor/bwrap
├── scripts/
│   ├── dev-backend.sh, dev-frontend.sh
│   └── deploy.sh               # update an existing server deployment
└── docs/                       # player-facing game guides
```

## Configuration

All secrets live in **one backend environment file** and never reach the browser.
Template: [`backend/.env.example`](backend/.env.example) (every variable is documented there).

| Variable | Required | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | prod | `production` enables strict startup checks (refuses to start if insecure) |
| `SUPABASE_URL` | ✅ | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | ✅ | used server-side for team password login |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | creating team accounts; Phase 1 data access. **Backend only.** |
| `SUPABASE_JWT_SECRET` | optional | verify sessions locally (faster); not needed for projects on the new JWT signing keys |
| `DATABASE_URL` | ✅ | Supabase Postgres (use the pooler, port 6543, for 300–400 players) |
| `FORENSIC_DATABASE_URL` | ✅ prod | read-only `forensic_reader` role for the Phase 2 Stage 1 SQL console |
| `SECRET_KEY` | ✅ | ≥ 32 random chars; signs organizer sessions |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | ✅ | organizer login (password ≥ 12 chars in production) |
| `COOKIE_SECURE` | ✅ prod | `true` behind HTTPS |
| `STAGE1_DELETION_KEY`, `CTF_PUZZLE3_CODE`, `CTF_CONTROL_TOKEN`, `STAGE4_SHUTDOWN_CODE`, `STAGE4_SEQUENCE` | no | Phase 2 answers. Leave empty to use defaults that match the in-game clues (see `.env.example`); editable later in admin |
| `CORS_ORIGINS` | no | leave empty (same-origin deployment) |
| `CODE_SANDBOX` | prod | `bwrap` in production (Phase 1 code isolation) |
| `CODE_EXEC_MAX_CONCURRENT`, `CODE_EXEC_QUEUE_TIMEOUT`, `CODE_EXEC_MEMORY_MB` | no | Phase 1 code-run limits |
| `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `GUNICORN_WORKERS` | no | capacity tuning |
| `LOG_LEVEL`, `ENABLE_DOCS` | no | logging; `/api/docs` (keep off in production) |

Frontend: [`frontend/.env.example`](frontend/.env.example) has a single, non-secret
`VITE_API_BASE_URL` (default `/api`). **Never** put keys in any `VITE_*` variable — they are
compiled into public JavaScript.

## Supabase setup (once)

1. Create a Supabase project.
2. SQL Editor → paste and run **all** of [`supabase/schema.sql`](supabase/schema.sql). It is safe to re-run.
3. In the SQL Editor, give the read-only console role a password (choose your own):
   ```sql
   ALTER ROLE forensic_reader WITH LOGIN PASSWORD '<strong-password>';
   ```
4. Authentication → Providers → Email: keep enabled; **disable "Allow new users to sign up"**
   (team accounts are created by organizers from the admin dashboard).
5. Authentication → Sessions / JWT: set the **access token (JWT) expiry** to cover the whole event
   (e.g. `43200` = 12 h). The backend keeps the access token only, so teams must sign in again
   when it expires.
6. Copy the URL, anon key, service-role key and database connection strings into the backend env file.

## Run locally

Requirements: Python 3.12, Node.js ≥ 20.19, a Supabase project (set up as above).

```bash
git clone https://github.com/adishshah29-eng/Codeverse_Merge.git codeverse
cd codeverse

# Backend
cp backend/.env.example backend/.env      # fill in your Supabase values
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal:

```bash
cd codeverse/frontend
npm ci
npm run dev          # http://localhost:5173  (proxies /api and /vendor to :8000)
```

Leave the Phase 2 answers in `.env` empty — the built-in defaults match the in-game clues.

Shortcuts: `./scripts/dev-backend.sh` and `./scripts/dev-frontend.sh`.

Open http://localhost:5173, sign in as the organizer (`ADMIN_USERNAME` / `ADMIN_PASSWORD`),
open **Phase 2 → admin → TEAM ACCOUNTS** to create a team, then sign in as that team.

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
sudo -u codeverse git clone https://github.com/adishshah29-eng/Codeverse_Merge.git /opt/codeverse

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

### 8. Updating later

```bash
cd /opt/codeverse
sudo -u codeverse ./scripts/deploy.sh
sudo systemctl restart codeverse-backend
```

## Operating the event

* **Health:** `GET /api/health` (process up), `GET /api/health/ready` (database reachable).
* **Logs:** `journalctl -u codeverse-backend -f` — one line per API request with status, time and
  request id; errors include a stack trace server-side only (clients get a generic 500 + request id).
* **Opening / closing phases:** organizer → Phase 2 admin → configuration → `active_phases`
  = `1`, `2` or `1,2`. Takes effect within ~5 seconds. Admin pages are never gated.
* **Teams:** create accounts once in Phase 2 admin → TEAM ACCOUNTS. A team's Phase 1 record is
  created automatically the first time it opens Phase 1. Deleting a team removes it from both phases.

### Capacity (300–400 concurrent players)

* Suggested server: 4 vCPU / 8 GB RAM, `GUNICORN_WORKERS=5`.
* Phase 1 code runs (Alarm System, Printing Press) are CPU-heavy: at most
  `GUNICORN_WORKERS × CODE_EXEC_MAX_CONCURRENT` run at once (default 5 × 2 = 10); extra
  requests wait up to `CODE_EXEC_QUEUE_TIMEOUT` seconds and then get a "busy, try again" message.
* Database connections ≈ `workers × (DB_POOL_SIZE + DB_MAX_OVERFLOW)` (+ up to 5 per worker for the
  SQL console). Use the Supabase **pooler** connection string.
* Set `SUPABASE_JWT_SECRET` (or use the new JWT signing keys) so team sessions are verified
  locally instead of one Supabase round-trip per request.

## Security model

* No secrets in the repository or the frontend bundle; `.env` files are git-ignored.
* Every table has Row Level Security enabled with no public policies, so the public Supabase
  keys can read nothing; the backend uses privileged server-side credentials.
* The Phase 2 Stage 1 SQL console runs as `forensic_reader`, which can only `SELECT` the five
  forensic tables (it cannot read answers, teams or `auth.users`).
* Phase 1 submitted Python runs in a bubblewrap sandbox: no network, no secrets in its environment,
  no view of the application code, `.env` or answer key, with CPU/memory/file limits.
* Team identity always comes from the verified session cookie; client-supplied team ids, scores,
  times and answers are never trusted. Wrong answers do not reveal the correct one.
* Phase 2 submission endpoints keep their per-team cooldown (`submission_cooldown_seconds`).
