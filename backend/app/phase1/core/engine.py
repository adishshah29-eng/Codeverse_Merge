import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from app.phase1.core.config import settings
from app.settings import settings as settings_app
from app.phase1.core.database import (
    decode_json,
    get_store,
    insert_row,
    log_audit,
    select_one,
    select_rows,
    update_rows,
    get_scoring_config,
)
from app.phase1.games.registry import hint_texts
from app.phase1.core.models import LeaderboardEntry, LeaderboardResponse, StageStatusResponse, TeamDashboardResponse


class ProgressionEngine:
    """Central progression, scoring, submissions, and leaderboard operations."""

    @staticmethod
    def get_or_create_team_for_core(core_team_id: int, name: str) -> Dict[str, Any]:
        """Return the Phase 1 record for a platform team, creating it on first use.

        Teams authenticate once through the platform login;
        their Phase 1 progress lives in p1_teams, linked by core_team_id.
        """
        team = select_one("p1_teams", {"core_team_id": core_team_id})
        if team:
            if not team["is_active"]:
                raise HTTPException(status_code=403, detail="Team has been deactivated by administrator.")
            ProgressionEngine.ensure_stage_rows(team)
            return team

        now = datetime.now(timezone.utc).isoformat()
        team_id = str(uuid.uuid4())
        try:
            team = insert_row("p1_teams", {
                "id": team_id,
                "core_team_id": core_team_id,
                "name": name.strip(),
                "is_active": True,
                "current_stage": 1,
                "total_score": 0.0,
                "total_penalty": 0.0,
                "created_at": now,
                "updated_at": now,
            })
        except Exception:
            # Another request created it concurrently (unique core_team_id).
            team = select_one("p1_teams", {"core_team_id": core_team_id})
            if not team:
                raise
            return team
        stages = [{
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "stage_id": stage_id,
            "status": "ACTIVE" if stage_id == 1 else "LOCKED",
            "score": 0.0,
            "started_at": now if stage_id == 1 else None,
            "completed_at": None,
            "attempts_count": 0,
            "wrong_attempts": 0,
            "hints_used": [],
            "penalty_points": 0.0,
            "metadata": {},
        } for stage_id in range(1, settings.TOTAL_STAGES + 1)]
        get_store().table("p1_stage_progress").insert(stages).execute()
        log_audit("TEAM_REGISTERED", {"team_name": name.strip(), "core_team_id": core_team_id}, team_id)
        return team

    @staticmethod
    def ensure_stage_rows(team: Dict[str, Any]) -> None:
        """Create progress rows for any stage a team doesn't have yet.

        Teams registered before stages were added (e.g. when Phase 1 had 5 stages) only have rows for those, which
        made the newer stages fail with "Stage progress not found". Missing rows start LOCKED, except the team's
        current stage, which starts ACTIVE.
        """
        have = {row["stage_id"] for row in select_rows("p1_stage_progress", {"team_id": team["id"]})}
        missing = [n for n in range(1, settings.TOTAL_STAGES + 1) if n not in have]
        if not missing:
            return
        now = datetime.now(timezone.utc).isoformat()
        rows = [{
            "id": str(uuid.uuid4()), "team_id": team["id"], "stage_id": n,
            "status": "ACTIVE" if n == team["current_stage"] else "LOCKED",
            "score": 0.0, "started_at": now if n == team["current_stage"] else None, "completed_at": None,
            "attempts_count": 0, "wrong_attempts": 0, "hints_used": [], "penalty_points": 0.0, "metadata": {},
        } for n in missing]
        get_store().table("p1_stage_progress").insert(rows).execute()
        log_audit("STAGE_ROWS_BACKFILLED", {"stages": missing}, team["id"])

    @staticmethod
    def get_team_by_id(team_id: str) -> Dict[str, Any]:
        team = select_one("p1_teams", {"id": team_id})
        if not team:
            raise HTTPException(status_code=404, detail="Team not found.")
        if not team["is_active"]:
            raise HTTPException(status_code=403, detail="Team has been deactivated by administrator.")
        return team

    @staticmethod
    def verify_stage_access(team_id: str, stage_id: int) -> Dict[str, Any]:
        team = ProgressionEngine.get_team_by_id(team_id)
        progress = select_one("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id})
        if not progress:
            raise HTTPException(status_code=404, detail="Stage progress not found.")
        if (settings.UNLOCK_ALL or settings_app.debug_unlock_all) and progress["status"] == "LOCKED":
            # debug mode: opening a stage out of order activates it
            now = datetime.now(timezone.utc).isoformat()
            update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {"status": "ACTIVE", "started_at": now})
            progress = select_one("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id})
        if stage_id > team["current_stage"] and progress["status"] == "LOCKED":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Security Alert: Stage {stage_id} is locked. You must complete or skip Stage {team['current_stage']} first.",
            )
        return progress

    @staticmethod
    def check_idempotency(team_id: str, stage_id: int, idempotency_key: str) -> Optional[Dict[str, Any]]:
        return select_one("p1_submissions", {
            "team_id": team_id,
            "stage_id": stage_id,
            "idempotency_key": idempotency_key,
        })

    @staticmethod
    def record_submission_attempt(
        team_id: str,
        stage_id: int,
        idempotency_key: str,
        payload: Dict[str, Any],
        passed: bool,
        score_awarded: float,
        feedback: str = "",
    ) -> None:
        insert_row("p1_submissions", {
            "id": str(uuid.uuid4()),
            "team_id": team_id,
            "stage_id": stage_id,
            "idempotency_key": idempotency_key,
            "payload": payload,
            "passed": passed,
            "score_awarded": score_awarded,
            "feedback": feedback,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        get_store().rpc("p1_increment_stage_attempt", {
            "p_team_id": team_id,
            "p_stage_id": stage_id,
            "p_passed": passed,
        }).execute()

    @staticmethod
    def _recalculate_team_totals(team_id: str) -> None:
        progress = select_rows("p1_stage_progress", {"team_id": team_id})
        update_rows("p1_teams", {"id": team_id}, {
            "total_score": sum(float(row["score"] or 0.0) for row in progress),
            "total_penalty": sum(float(row["penalty_points"] or 0.0) for row in progress),
        })

    @staticmethod
    def complete_stage(team_id: str, stage_id: int, final_score: float, metadata: Optional[Dict[str, Any]] = None) -> None:
        now = datetime.now(timezone.utc).isoformat()
        score = max(0.0, min(10.0, round(float(final_score), 2)))
        update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {
            "status": "COMPLETED", "score": score, "completed_at": now, "metadata": metadata or {},
        })
        next_stage = stage_id + 1
        if next_stage <= settings.TOTAL_STAGES:
            update_rows("p1_stage_progress", {
                "team_id": team_id, "stage_id": next_stage, "status": "LOCKED",
            }, {"status": "ACTIVE", "started_at": now})
        team_row = select_one("p1_teams", {"id": team_id})
        update_rows("p1_teams", {"id": team_id}, {
            "current_stage": max(int(team_row["current_stage"]), min(next_stage, settings.TOTAL_STAGES + 1)), "updated_at": now,
        })
        ProgressionEngine._recalculate_team_totals(team_id)
        log_audit("STAGE_COMPLETED", {"stage_id": stage_id, "score": score, "next_stage": next_stage}, team_id)

    @staticmethod
    def skip_stage(team_id: str, stage_id: int) -> Dict[str, Any]:
        progress = ProgressionEngine.verify_stage_access(team_id, stage_id)
        if progress["status"] in ("COMPLETED", "SKIPPED"):
            raise HTTPException(status_code=400, detail=f"Stage {stage_id} has already been finalized ({progress['status']}).")

        now = datetime.now(timezone.utc).isoformat()
        skip_award = float(settings.SKIP_AWARD_POINTS)
        skip_penalty = float(settings.SKIP_PENALTY_DEDUCTION)
        metadata = decode_json(progress["metadata"], {})
        metadata.update({"skipped": 1, "skip_time": now})
        update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {
            "status": "SKIPPED",
            "score": skip_award,
            "penalty_points": float(progress["penalty_points"] or 0.0) + skip_penalty,
            "completed_at": now,
            "metadata": metadata,
        })
        next_stage = stage_id + 1
        if next_stage <= settings.TOTAL_STAGES:
            update_rows("p1_stage_progress", {
                "team_id": team_id, "stage_id": next_stage, "status": "LOCKED",
            }, {"status": "ACTIVE", "started_at": now})
        team_row = select_one("p1_teams", {"id": team_id})
        update_rows("p1_teams", {"id": team_id}, {
            "current_stage": max(int(team_row["current_stage"]), min(next_stage, settings.TOTAL_STAGES + 1)), "updated_at": now,
        })
        ProgressionEngine._recalculate_team_totals(team_id)
        log_audit("STAGE_SKIPPED", {
            "stage_id": stage_id, "skip_award": skip_award,
            "skip_penalty": skip_penalty, "next_stage": next_stage,
        }, team_id)
        return {
            "success": True,
            "stage_id": stage_id,
            "status": "SKIPPED",
            "score_awarded": skip_award,
            "penalty_applied": skip_penalty,
            "next_stage": next_stage if next_stage <= settings.TOTAL_STAGES else None,
            "mission_complete": next_stage > settings.TOTAL_STAGES,
        }

    @staticmethod
    def unlock_hint(team_id: str, stage_id: int, hint_index: int) -> Dict[str, Any]:
        progress = ProgressionEngine.verify_stage_access(team_id, stage_id)
        texts = hint_texts(stage_id)       # empty for the original Royal Mint stages (hints live in their UI)
        legacy = stage_id <= settings.LEGACY_STAGES
        if not legacy and not 0 <= hint_index < len(texts):
            raise HTTPException(status_code=404, detail="No such hint for this stage.")
        hint_text = texts[hint_index] if 0 <= hint_index < len(texts) else None
        hints = decode_json(progress["hints_used"], [])
        if hint_index in hints:
            return {"success": True, "hint_index": hint_index, "already_unlocked": True, "text": hint_text}
        hints.append(hint_index)
        hints.sort()
        config = get_scoring_config().get(f"game_{stage_id}", {})
        penalties = config.get("hint_penalties", [0.5, 1.0, 1.5])
        penalty = penalties[hint_index] if 0 <= hint_index < len(penalties) else 0.5
        update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {
            "hints_used": hints,
            "penalty_points": float(progress["penalty_points"] or 0.0) + penalty,
        })
        if not legacy:
            ProgressionEngine.refresh_stage_score(team_id, stage_id)
        log_audit("HINT_UNLOCKED", {"stage_id": stage_id, "hint_index": hint_index, "penalty": penalty}, team_id)
        return {"success": True, "hint_index": hint_index, "penalty": penalty, "hints_used": hints, "text": hint_text}

    @staticmethod
    def refresh_stage_score(team_id: str, stage_id: int) -> float:
        """Recompute an ACTIVE stage's running score from its best raw grade, hints and wrong attempts.

        Challenges award partial credit, so the leaderboard shows each team's current best while a stage is open.
        """
        from app.phase1.core.scoring import net_stage_score
        progress = select_one("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id})
        if not progress or progress["status"] != "ACTIVE" or stage_id <= settings.LEGACY_STAGES:
            return float(progress["score"]) if progress else 0.0
        meta = decode_json(progress["metadata"], {})
        net = net_stage_score(stage_id, float(meta.get("best_raw", 0.0)), int(progress["wrong_attempts"]),
                              decode_json(progress["hints_used"], []))
        update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {"score": net["score"]})
        ProgressionEngine._recalculate_team_totals(team_id)
        return net["score"]

    @staticmethod
    def get_team_dashboard(team_id: str) -> TeamDashboardResponse:
        team = ProgressionEngine.get_team_by_id(team_id)
        rows = select_rows("p1_stage_progress", {"team_id": team_id}, "stage_id")
        now = datetime.now(timezone.utc)
        scoring_config = get_scoring_config()
        stages = []
        for row in rows:
            elapsed = None
            if row["started_at"]:
                try:
                    started = datetime.fromisoformat(row["started_at"].replace("Z", "+00:00"))
                    ended_value = row["completed_at"]
                    ended = datetime.fromisoformat(ended_value.replace("Z", "+00:00")) if ended_value else now
                    elapsed = int((ended - started).total_seconds())
                except (TypeError, ValueError):
                    pass
            stage_id = row["stage_id"]
            stages.append(StageStatusResponse(
                stage_id=stage_id,
                stage_name=settings.STAGE_NAMES.get(stage_id, f"Stage {stage_id}"),
                status=row["status"],
                score=float(row["score"]),
                max_score=10.0,
                started_at=row["started_at"],
                completed_at=row["completed_at"],
                time_elapsed_seconds=elapsed,
                time_limit_seconds=scoring_config.get(f"game_{stage_id}", {}).get("duration_seconds"),
                attempts_count=row["attempts_count"],
                wrong_attempts=row["wrong_attempts"],
                hints_used=decode_json(row["hints_used"], []),
                penalty_points=float(row["penalty_points"]),
            ))

        teams = select_rows("p1_teams", {"is_active": True})
        teams.sort(key=lambda row: (-float(row["total_score"]), row["updated_at"]))
        rank = next((index for index, row in enumerate(teams, start=1) if row["id"] == team_id), 1)
        return TeamDashboardResponse(
            team_id=team["id"], team_name=team["name"], current_stage=team["current_stage"],
            total_score=float(team["total_score"]), total_penalty=float(team["total_penalty"]),
            stages=stages, rank=rank, total_teams=len(teams), debug_unlock_all=settings_app.debug_unlock_all,
            unlock_all=settings.UNLOCK_ALL or settings_app.debug_unlock_all,
        )

    @staticmethod
    def get_leaderboard() -> LeaderboardResponse:
        teams = select_rows("p1_teams", {"is_active": True})
        teams.sort(key=lambda row: (-float(row["total_score"]), row["updated_at"]))
        progress_rows = select_rows("p1_stage_progress")
        progress_by_team: Dict[str, List[Dict[str, Any]]] = {}
        for row in progress_rows:
            progress_by_team.setdefault(row["team_id"], []).append(row)
        entries = []
        for rank, team in enumerate(teams, start=1):
            progress = progress_by_team.get(team["id"], [])
            entries.append(LeaderboardEntry(
                rank=rank,
                team_id=team["id"],
                team_name=team["name"],
                current_stage=team["current_stage"],
                total_score=float(team["total_score"]),
                total_penalty=float(team["total_penalty"]),
                stage_scores={f"stage_{row['stage_id']}": float(row["score"]) for row in progress},
                completed_stages_count=sum(row["status"] in ("COMPLETED", "SKIPPED") for row in progress),
                last_activity=team["updated_at"],
            ))
        return LeaderboardResponse(leaderboard=entries, updated_at=datetime.now(timezone.utc).isoformat())

    @staticmethod
    def admin_reset_team(team_id: str, target_stage: int = 1) -> None:
        now = datetime.now(timezone.utc).isoformat()
        for stage_id in range(target_stage, settings.TOTAL_STAGES + 1):
            update_rows("p1_stage_progress", {"team_id": team_id, "stage_id": stage_id}, {
                "status": "ACTIVE" if stage_id == target_stage else "LOCKED",
                "score": 0.0,
                "started_at": now if stage_id == target_stage else None,
                "completed_at": None,
                "attempts_count": 0,
                "wrong_attempts": 0,
                "hints_used": [],
                "penalty_points": 0.0,
                "metadata": {},
            })
        update_rows("p1_teams", {"id": team_id}, {"current_stage": target_stage, "updated_at": now})
        ProgressionEngine._recalculate_team_totals(team_id)
        log_audit("ADMIN_RESET_TEAM", {"target_stage": target_stage}, team_id)