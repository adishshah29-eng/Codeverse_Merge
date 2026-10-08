# Solutions: Problem 2 (Alarm System) stuck on "Loading..."

## Symptoms
- The code editor on Stage 02 shows "Loading..." indefinitely.
- **Run Test** / **Neutralize** returns HTTP 500 from `POST /api/phase1/games/2/run`.
- Backend log ends with `subprocess.SubprocessError: Exception occurred in preexec_fn.`
- `403` on `/api/admin/*` in the log is unrelated (the team is not an admin).

## Cause 1: sandbox crashed on macOS
`backend/app/phase1/games/sandbox.py` applied resource limits in `preexec_fn`.
macOS rejects `RLIMIT_AS` (memory cap), so the child died before starting.

**Fix:** limits are applied best-effort, and `RLIMIT_AS` is skipped on macOS.
Linux keeps every limit.

## Cause 2: Monaco editor loaded from a CDN
`@monaco-editor/react` fetches Monaco from jsDelivr by default. If the CDN is
slow or blocked, the editor never leaves "Loading...".

**Fix:** Monaco is bundled with the app.
- `monaco-editor` added to `frontend/package.json`.
- `frontend/src/shared/monacoSetup.js` points the loader at the local bundle.
- Imported by `Game2AlarmSystem.jsx` and `Game5PrintingPress.jsx`.

## Apply locally
```
git fetch origin claude/stoic-goldberg-c1f7et
git checkout claude/stoic-goldberg-c1f7et
git pull origin claude/stoic-goldberg-c1f7et
cd frontend && npm install
```
Restart the backend and the frontend dev server.

## Verify
1. Open Stage 02: the editor shows code (works with the network blocked from jsDelivr).
2. Click **Run Test**: output appears in the console, no 500 in the backend log.
