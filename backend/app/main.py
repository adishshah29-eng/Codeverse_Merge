from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .db import Base, engine, SessionLocal
from .games.money_trail.engine import init_money_trail_db
from .models import ConfigKV, HintCatalog, PoliceClock, StageProgress, Team
from .routers import admin, auth, ctf, extraction, hints, market, money_trail, police, stages
from .settings import ROOT, settings


def seed_database():
    """Initializes tables and seeds initial teams, hint catalog, clocks, and config if not already present."""
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
    seed_database()
    yield


app = FastAPI(
    title=settings.app_name,
    description="Unified CODEVERSE 2.0 Heist Game Central Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()] or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(auth.router)
app.include_router(stages.router)
app.include_router(hints.router)
app.include_router(money_trail.router)
app.include_router(ctf.router)
app.include_router(police.router)
app.include_router(extraction.router)
app.include_router(market.router)
app.include_router(admin.router)

# Mount vendor static assets if present
vendor_path = ROOT / "vendor"
if vendor_path.exists():
    app.mount("/vendor", StaticFiles(directory=str(vendor_path)), name="vendor")


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "database": "connected",
    }
