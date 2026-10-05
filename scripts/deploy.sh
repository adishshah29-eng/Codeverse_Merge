#!/usr/bin/env bash
# Update an existing Ubuntu deployment in place (run from the repo root on the server):
#   sudo -u codeverse ./scripts/deploy.sh   → then: sudo systemctl restart codeverse-backend
# First-time setup is described in README.md ("Deploying on Ubuntu").
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Backend dependencies"
[ -d backend/.venv ] || python3 -m venv backend/.venv
backend/.venv/bin/pip install --quiet --upgrade pip
backend/.venv/bin/pip install --quiet -r backend/requirements.txt

echo "==> Frontend build"
(cd frontend && npm ci --no-audit --no-fund && npm run build)

echo "==> Done. Now run: sudo systemctl restart codeverse-backend && sudo systemctl reload nginx"
