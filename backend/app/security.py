import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import AuditEvent, ConfigKV


def record_submission_attempt(db: Session, team_id: int, event_type: str) -> None:
    config = db.query(ConfigKV).filter(ConfigKV.key == "submission_cooldown_seconds").one_or_none()
    try:
        cooldown = max(0.0, float(config.value)) if config else 2.0
    except ValueError:
        cooldown = 2.0

    now = datetime.utcnow()
    previous = (
        db.query(AuditEvent)
        .filter(AuditEvent.team_id == team_id, AuditEvent.event_type == event_type)
        .order_by(AuditEvent.id.desc())
        .first()
    )
    if previous:
        elapsed = max(0.0, (now - previous.created_at).total_seconds())
        if elapsed < cooldown:
            retry_after = max(1, int(cooldown - elapsed + 0.999))
            db.add(AuditEvent(
                team_id=team_id,
                event_type="submission_rate_limited",
                payload=json.dumps({"endpoint": event_type, "retry_after_seconds": retry_after}),
            ))
            db.commit()
            raise HTTPException(status_code=429, detail="Submission cooldown active. Try again shortly.")

    db.add(AuditEvent(team_id=team_id, event_type=event_type, payload="{}"))
    db.flush()