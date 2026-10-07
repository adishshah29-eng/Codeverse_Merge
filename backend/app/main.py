import hashlib
import logging
import secrets
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from .logging_config import configure_logging
from .settings import settings

configure_logging()

from .db import Base, engine, SessionLocal  # noqa: E402
from .games.money_trail.engine import init_money_trail_db  # noqa: E402
from .models import ConfigKV, HintCatalog, PoliceClock, StageProgress, Team  # noqa: E402
from .phases import ACTIVE_PHASES_KEY, DEFAULT_ACTIVE_PHASES, active_phases, require_phase  # noqa: E402
from .routers import admin, auth, ctf, extraction, hints, market, money_trail, police, stages  # noqa: E402
from .phase1.core.database import seed_default_scoring_config  # noqa: E402
from .phase1.games.sandbox import log_sandbox_status  # noqa: E402
from .phase1.routers import admin as p1_admin  # noqa: E402
from .phase1.routers import games as p1_games  # noqa: E402
from .phase1.routers import leaderboard as p1_leaderboard  # noqa: E402
from .phase1.routers import progression as p1_progression  # noqa: E402

logger = logging.getLogger("codeverse")

# Arbitrary constant: serializes startup seeding across Gunicorn workers.
_SEED_LOCK_ID = 727_2026


def event_answer_defaults() -> dict:
    """Defaults for Phase 2 answers when the corresponding .env value is empty."""
    return {
        # Stage 1: the terminal log tells teams the key is
        # SHA256(TXN-884920:BADGE-991:48500000).
        "stage1_deletion_key": hashlib.sha256(b"TXN-884920:BADGE-991:48500000").hexdigest().upper(),
        # Stage 2: teams read these from the game itself, so any value works.
        "ctf_puzzle3_code": f"IVB-AUDIT-{secrets.token_hex(3).upper()}",
        "ctf_control_token": f"MINT-OMEGA-{secrets.token_hex(3).upper()}",
        # Stage 4: shown to teams on the Phase 1 completion screen and by the
        # Black Market classified drop.
        "stage4_shutdown_code": "MINT-FREQUENCY-912",
        # Stage 4: the order described by the on-screen field notes.
        "stage4_sequence": "surveillance,alarm,locks,passage,crew",
    }


def seed_database():
    """Initializes tables and seeds initial teams, hint catalog, clocks, and config if not already present."""
    with engine.connect() as lock_conn:
        # Every worker / serverless instance runs startup; only one may seed at
        # a time. A transaction-scoped lock is released automatically on commit
        # or disconnect, so it is also safe behind Supabase's transaction pooler.
        with lock_conn.begin():
            lock_conn.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": _SEED_LOCK_ID})
            _seed_database()


def _seed_database():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # 1. Seed default Hint Catalog
        if db.query(HintCatalog).count() == 0:
            default_hints = [
                # Stage 1 Hints
                HintCatalog(
                    id="hint_s1_01",
                    stage=1,
                    title="Suspicious After-Hours Card Swipes",
                    body="Look for badge swipes in 'Core Server Room B-4' between 02:30 and 03:00. Note the employee clearance level.",
                    penalty=1.0,
                    enabled=True,
                    sort_order=1,
                ),
                HintCatalog(
                    id="hint_s1_02",
                    stage=1,
                    title="Terminal Command Audit Extraction",
                    body="Cross-examine terminal TERM-SEC-09 logs. The shell command history contains the key derivation signature.",
                    penalty=2.0,
                    enabled=True,
                    sort_order=2,
                ),
                # Stage 2 Hints
                HintCatalog(
                    id="hint_s2_01",
                    stage=2,
                    title="Bypassing Teller Login Query",
                    body="The server uses single quotes around input: SELECT * FROM tellers WHERE user='<input>'. Terminate the string and supply an always-true tautology without using comments.",
                    penalty=1.0,
                    enabled=True,
                    sort_order=1,
                ),
                HintCatalog(
                    id="hint_s2_02",
                    stage=2,
                    title="Header vs Body in Balance API",
                    body="Sector 3: The audit code is NOT in the JSON body. Inspect the HTTP response headers in DevTools Network tab for 'X-Audit-Code' on your second fetch.",
                    penalty=1.5,
                    enabled=True,
                    sort_order=2,
                ),
                # Stage 3 Hints
                HintCatalog(
                    id="hint_s3_01",
                    stage=3,
                    title="Avoiding Closing Corridors",
                    body="Check window_start and window_end on each edge in the graph. Naive shortest paths hit closed gates at t > 30.",
                    penalty=1.0,
                    enabled=True,
                    sort_order=1,
                ),
                # Stage 4 Hints
                HintCatalog(
                    id="hint_s4_01",
                    stage=4,
                    title="Subsystem Sequence Precedence",
                    body="The Professor's rule: Disarm surveillance first, then vault alarm, unlock access gates, blow the transit passage, and finally signal the crew.",
                    penalty=1.5,
                    enabled=True,
                    sort_order=1,
                ),
            ]
            for h in default_hints:
                db.add(h)
            db.commit()

        # 3. Seed ALL game configuration defaults
        # These keys drive ALL game logic — never hardcoded in routers.
        # Admins can change any of these via PUT /api/admin/config/{key}
        config_defaults = {
            # Which competition phases teams can currently play ("1", "2" or "1,2")
            ACTIVE_PHASES_KEY: DEFAULT_ACTIVE_PHASES,
            # Stage skip
            "stage_skip_penalty": "3.0",
            # Stage 1 — Money Trail
            "stage1_max_score": "10.0",
            # Stage 2 — CTF Control Server
            "ctf_decoy_body_code": "FAKE-000-DECOY",
            "ctf_puzzle1_points": "3",
            "ctf_puzzle2_points": "3",
            "ctf_puzzle3_points": "4",
            "stage2_max_score": "10.0",
            # Stage 3 — Outrun Police
            "police_budget": "100.0",
            "police_initial_time": "10.0",
            "police_deadline": "120.0",
            "police_min_score": "3.0",
            "police_max_score": "10.0",
            "police_risk_score_factor": "0.3",
            # Stage 4 — Extraction
            "stage4_max_score": "10.0",
            "extraction_timer_seconds": "300",
            "extraction_wrong_sequence_penalty": "1.5",
            # Final score formula multipliers
            "score_money_divisor": "1000.0",
            "score_risk_multiplier": "0.2",
            "score_time_multiplier": "0.01",
            # Black Market
            "market_inflation_rate": "0.25",
            "market_min_completed_stage": "1",
            "submission_cooldown_seconds": "2.0",
        }

        configured_secrets = {
            "stage1_deletion_key": settings.stage1_deletion_key,
            "ctf_puzzle3_code": settings.ctf_puzzle3_code,
            "ctf_control_token": settings.ctf_control_token,
            "stage4_shutdown_code": settings.stage4_shutdown_code,
            "stage4_sequence": settings.stage4_sequence,
        }
        config_defaults.update({key: value for key, value in configured_secrets.items() if value})
        # Event answers left empty in .env fall back to values that are consistent
        # with the in-game clues, so no stage is ever unsolvable by configuration.
        for key, value in event_answer_defaults().items():
            config_defaults.setdefault(key, value)

        for key, value in config_defaults.items():
            if not db.query(ConfigKV).filter(ConfigKV.key == key).one_or_none():
                db.add(ConfigKV(key=key, value=value))
        db.commit()

        secret_values = [
            row.value
            for row in db.query(ConfigKV).all()
            if any(part in row.key.lower() for part in ("key", "code", "token", "secret"))
        ]
        init_money_trail_db(db, secret_values)
        db.commit()

        clock = db.query(PoliceClock).filter(PoliceClock.id == 1).one_or_none()
        if not clock:
            initial_time = db.query(ConfigKV).filter(ConfigKV.key == "police_initial_time").one().value
            db.add(PoliceClock(id=1, t=float(initial_time), running=True, compromised_json="[]"))
            db.commit()

    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_production:
        problems = settings.production_problems()
        if problems:
            for problem in problems:
                logger.critical("Configuration error: %s", problem)
            raise RuntimeError("Refusing to start in production with invalid configuration: " + "; ".join(problems))
    seed_database()
    seed_default_scoring_config()
    log_sandbox_status()
    logger.info("CODEVERSE backend started (environment=%s)", settings.environment)
    yield


app = FastAPI(
    title=settings.app_name,
    description="Unified CODEVERSE 2.0 Heist Game Central Platform",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.enable_docs else None,
)

# CORS is only needed when the frontend is served from a different origin.
# With the standard Nginx setup (same origin) CORS_ORIGINS stays empty.
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    )


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex[:16]
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error id=%s %s %s", request_id, request.method, request.url.path)
        response = JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
        )
    duration_ms = (time.perf_counter() - started) * 1000
    # Some game routes set their own X-Request-Id as part of a puzzle; keep it.
    if "x-request-id" not in response.headers:
        response.headers["X-Request-ID"] = request_id
    if request.url.path.startswith("/api/"):
        level = logging.WARNING if response.status_code >= 500 else logging.INFO
        logger.log(level, "%s %s %s %.0fms id=%s", request.method, request.url.path,
                   response.status_code, duration_ms, request_id)
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(part) for part in err.get("loc", ())[1:]), "message": err.get("msg", "")}
        for err in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": "Invalid request", "errors": errors})


# ── Shared: platform login (team + admin), used by every frontend ────────────
app.include_router(auth.router)
app.include_router(admin.router)

# ── Phase 2 (Unified Heist) — served at /api/* as before ────────────────────
phase2 = [Depends(require_phase(2))]
for router in (stages.router, hints.router, money_trail.router, ctf.router,
               police.router, extraction.router, market.router):
    app.include_router(router, dependencies=phase2)

# ── Phase 1 (Royal Mint Heist) — served at /api/phase1/* ─────────────────────
phase1 = [Depends(require_phase(1))]
app.include_router(p1_progression.router, prefix="/api/phase1", dependencies=phase1)
app.include_router(p1_games.router, prefix="/api/phase1", dependencies=phase1)
app.include_router(p1_leaderboard.router, prefix="/api/phase1")
app.include_router(p1_admin.router, prefix="/api/phase1")

# /vendor (static game assets) now lives in frontend/public/vendor and is
# served with the frontend build (Vite in development, Nginx/Vercel in production).


@app.get("/api/health")
def health_check():
    """Liveness: the process is up. Does not touch the database."""
    return {"status": "healthy", "app": settings.app_name}


@app.get("/api/health/ready")
def readiness_check():
    """Readiness: the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Readiness check failed")
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": "unreachable"})
    return {"status": "ready", "database": "connected"}


@app.get("/api/phases")
def list_phases():
    """Which competition phases are currently open (used by the landing page)."""
    return {"active_phases": sorted(active_phases())}
