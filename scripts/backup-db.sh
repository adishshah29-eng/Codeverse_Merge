#!/usr/bin/env bash
# Consistent online backup of the SQLite database (safe while the app runs).
# Usage: backup-db.sh [database-path] [backup-dir]
#   Defaults: /var/lib/codeverse/codeverse.db  /var/backups/codeverse
# Keeps the newest 48 backups. Run by deploy/systemd/codeverse-backup.timer.
set -euo pipefail

DB="${1:-${DATABASE_PATH:-/var/lib/codeverse/codeverse.db}}"
DEST="${2:-/var/backups/codeverse}"
KEEP=48

mkdir -p "$DEST"
chmod 700 "$DEST"
OUT="$DEST/codeverse-$(date -u +%Y%m%dT%H%M%SZ).db"

python3 - "$DB" "$OUT" <<'PY'
import sqlite3, sys
src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
dst = sqlite3.connect(sys.argv[2])
with dst:
    src.backup(dst)          # SQLite online backup API: consistent snapshot
dst.execute("PRAGMA integrity_check").fetchone()
dst.close(); src.close()
PY
chmod 600 "$OUT"
echo "Backup written: $OUT"

ls -1t "$DEST"/codeverse-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
