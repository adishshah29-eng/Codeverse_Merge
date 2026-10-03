import json
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.utcnow()


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    supabase_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    money: Mapped[int] = mapped_column(Integer, default=10000)
    risk: Mapped[float] = mapped_column(Float, default=0)
    current_stage: Mapped[int] = mapped_column(Integer, default=1)
    black_market_unlocked: Mapped[bool] = mapped_column(Boolean, default=False)
    black_market_purchases: Mapped[int] = mapped_column(Integer, default=0)
    final_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    event_started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class GameOutput(Base):
    __tablename__ = "game_outputs"
    __table_args__ = (UniqueConstraint("team_id", "key", name="uq_team_output"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    key: Mapped[str] = mapped_column(String(64))
    value: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class StageProgress(Base):
    __tablename__ = "stage_progress"
    __table_args__ = (UniqueConstraint("team_id", "stage", name="uq_team_stage"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    stage: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(24), default="locked")  # locked|open|completed|skipped
    score: Mapped[float] = mapped_column(Float, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ConfigKV(Base):
    __tablename__ = "config_kv"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), index=True)
    payload: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    stage: Mapped[str] = mapped_column(String(32), index=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[str] = mapped_column(Text, default="{}")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    event_t: Mapped[float | None] = mapped_column(Float, nullable=True)
    route_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class HintCatalog(Base):
    __tablename__ = "hint_catalog"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    stage: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    penalty: Mapped[float] = mapped_column(Float, default=1.0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class HintUse(Base):
    __tablename__ = "hint_uses"
    __table_args__ = (UniqueConstraint("team_id", "hint_id", name="uq_hint_use"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    hint_id: Mapped[str] = mapped_column(String(64))
    penalty: Mapped[float] = mapped_column(Float, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Penalty(Base):
    __tablename__ = "penalties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    reason: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MarketPurchase(Base):
    __tablename__ = "market_purchases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    item_id: Mapped[str] = mapped_column(String(64))
    category: Mapped[str] = mapped_column(String(32))
    price: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CtfState(Base):
    __tablename__ = "ctf_state"

    team_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lives: Mapped[int] = mapped_column(Integer, default=3)
    score: Mapped[int] = mapped_column(Integer, default=0)
    start_time: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    balance_request_count: Mapped[int] = mapped_column(Integer, default=0)
    puzzles_json: Mapped[str] = mapped_column(Text, default="{}")
    submission_timestamps: Mapped[str] = mapped_column(Text, default="[]")


class PoliceClock(Base):
    __tablename__ = "police_clock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    t: Mapped[float] = mapped_column(Float, default=0)
    running: Mapped[bool] = mapped_column(Boolean, default=False)
    wall_started: Mapped[float | None] = mapped_column(Float, nullable=True)
    compromised_json: Mapped[str] = mapped_column(Text, default="[]")


class TeamCompromise(Base):
    __tablename__ = "team_compromises"
    __table_args__ = (UniqueConstraint("team_id", "node_id", name="uq_team_node"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    team_id: Mapped[int] = mapped_column(Integer, index=True)
    node_id: Mapped[str] = mapped_column(String(16))


class EventClock(Base):
    __tablename__ = "event_clock"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    running: Mapped[bool] = mapped_column(Boolean, default=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=7200)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


def dumps(obj) -> str:
    return json.dumps(obj, default=str)
