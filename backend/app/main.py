from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .auth import hash_password
from .db import Base, engine, SessionLocal
from .games.money_trail.engine import init_money_trail_db
from .models import ConfigKV, HintCatalog, PoliceClock, StageProgress, Team
from .routers import admin, auth, ctf, extraction, hints, market, money_trail, police, stages
from .settings import ROOT, settings


def seed_database():
    """Initializes tables and seeds initial teams, hint catalog, and clocks if not already present."""
    Base.metadata.create_all(bind=engine)
    init_money_trail_db()

    db = SessionLocal()
    try:
        # 1. Seed teams (TEAM01 to TEAM10)
        team_count = db.query(Team).count()
        if team_count == 0:
            default_teams = [
                ("TEAM01", "La Resistencia (Alpha)", 12000),
                ("TEAM02", "Los Bandidos (Bravo)", 10000),
                ("TEAM03", "Tokyo Syndicate", 10000),
                ("TEAM04", "Berlin Vanguard", 10000),
                ("TEAM05", "Nairobi Infiltrators", 10000),
                ("TEAM06", "Rio Cyber Operatives", 10000),
                ("TEAM07", "Denver Demolition Crew", 10000),
                ("TEAM08", "Helsinki Heavy Unit", 10000),
                ("TEAM09", "Bogota Tactical Cell", 10000),
                ("TEAM10", "Palermo Masterminds", 10000),
            ]
            for code, name, money in default_teams:
                team = Team(
                    code=code,
                    name=name,
                    password_hash=hash_password(settings.seed_team_password),
                    money=money,
                    risk=0.0,
                    current_stage=1,
                    black_market_unlocked=False,
                    black_market_purchases=0,
                )
                db.add(team)
            db.commit()

            # Initialize stage progress rows for all seeded teams
            all_teams = db.query(Team).all()
            for t in all_teams:
                for s in range(1, 5):
                    status = "open" if s == 1 else "locked"
                    db.add(StageProgress(team_id=t.id, stage=s, status=status, score=0.0))
            db.commit()

        # 2. Seed police clock
        clock = db.query(PoliceClock).filter(PoliceClock.id == 1).one_or_none()
        if not clock:
            db.add(PoliceClock(id=1, t=10.0, running=True, compromised_json="[]"))
            db.commit()

        # 3. Seed default Hint Catalog
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
                    body="Cross-examine terminal TERM-SEC-09 logs. The shell command history contains the exact key derivation signature.",
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

        # 4. Seed config KV defaults
        if not db.query(ConfigKV).filter(ConfigKV.key == "stage_skip_penalty").one_or_none():
            db.add(ConfigKV(key="stage_skip_penalty", value="3.0"))
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
