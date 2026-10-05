#!/usr/bin/env bash
# Local development: Vite on http://localhost:5173 (proxies /api to the backend).
set -euo pipefail
cd "$(dirname "$0")/../frontend"
[ -d node_modules ] || npm ci
exec npm run dev
