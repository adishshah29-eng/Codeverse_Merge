#!/usr/bin/env bash
# Local development: FastAPI with auto-reload on http://127.0.0.1:8000
# Requires backend/.env (copy backend/.env.example).
set -euo pipefail
cd "$(dirname "$0")/../backend"

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip
  .venv/bin/pip install -r requirements.txt
fi
[ -f .env ] || { echo "backend/.env is missing — copy backend/.env.example and fill it in." >&2; exit 1; }

exec .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
