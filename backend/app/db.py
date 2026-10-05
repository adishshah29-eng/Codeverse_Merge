"""SQLite database access for the whole platform.

One database file is shared by every Gunicorn worker. To make that safe and
fast under event load:

* WAL journal mode: readers never block writers and vice versa.
* busy_timeout: a writer waits (instead of failing) while another commits.
* Requests that change data (POST/PUT/PATCH/DELETE) open their transaction
  with BEGIN IMMEDIATE, taking the write lock up front. Without that, a
  transaction that reads first and writes later can fail with "database is
  locked" if another worker committed in between.
"""
import contextvars
import os
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .settings import settings


class Base(DeclarativeBase):
    pass


DATABASE_PATH = Path(settings.database_path)
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

# Set per request by the middleware in main.py.
write_intent: contextvars.ContextVar[bool] = contextvars.ContextVar("write_intent", default=False)


def configure_connection(conn: sqlite3.Connection) -> None:
    """PRAGMAs applied to every SQLite connection (SQLAlchemy and Phase 1)."""
    conn.execute(f"PRAGMA busy_timeout = {int(settings.sqlite_busy_timeout_ms)}")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")


engine = create_engine(
    f"sqlite:///{DATABASE_PATH}",
    connect_args={"check_same_thread": False, "timeout": settings.sqlite_busy_timeout_ms / 1000},
    pool_size=10,
    max_overflow=10,
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _on_connect(dbapi_connection, _record):
    # Let SQLAlchemy (not the sqlite3 module) decide when transactions begin.
    dbapi_connection.isolation_level = None
    configure_connection(dbapi_connection)


@event.listens_for(engine, "begin")
def _on_begin(conn):
    conn.exec_driver_sql("BEGIN IMMEDIATE" if write_intent.get() else "BEGIN")


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def secure_database_files() -> None:
    """The database holds answers and password hashes: owner-only access."""
    for suffix in ("", "-wal", "-shm"):
        path = Path(f"{DATABASE_PATH}{suffix}")
        if path.exists():
            os.chmod(path, 0o600)
