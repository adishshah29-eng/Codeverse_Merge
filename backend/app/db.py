from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .settings import settings


class Base(DeclarativeBase):
    pass


def _normalize_url(url: str, name: str):
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if not url.startswith(("postgresql://", "postgresql+psycopg2://")):
        raise RuntimeError(f"{name} must be a Supabase PostgreSQL connection string")
    return url


url = _normalize_url(settings.database_url, "DATABASE_URL")

# Pool sizes are per worker process: total connections ≈ workers × (pool_size + max_overflow).
engine = create_engine(
    url,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Separate low-privilege connection for team-written SQL (Phase 2 Stage 1).
forensic_engine = (
    create_engine(
        _normalize_url(settings.forensic_database_url, "FORENSIC_DATABASE_URL"),
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=3,
        pool_recycle=1800,
    )
    if settings.forensic_database_url
    else None
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
