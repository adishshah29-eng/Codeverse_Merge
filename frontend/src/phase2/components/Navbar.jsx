import React, { useEffect, useState } from "react";
import { STAGE_INFO } from "../stageInfo";

function elapsedTime(startedAt, now) {
  if (!startedAt) return "–";
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// Two quiet rows: who you are + your numbers + four text actions, then one line of stage tabs.
export default function Navbar({ team, role, stages = [], activeView, setActiveView, onOpenMarket, onOpenHints, onLogout }) {
  const [now, setNow] = useState(Date.now());
  const currentStage = team?.current_stage || 1;
  const score = team?.final_score ?? Object.values(team?.stage_scores || {}).reduce((sum, v) => sum + v, 0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="p2-bar">
      <div className="p2-bar-row">
        <button className="p2-brand" onClick={() => setActiveView(role === "admin" ? "admin" : "dashboard")}>
          Operación Fuga
        </button>
        {role === "team" && team && <span className="p2-who">{team.code} · {team.name}</span>}
        {role === "admin" && <span className="p2-who">Organizer</span>}

        {role === "team" && team && (
          <dl className="p2-stats" aria-label="Your numbers">
            <div title="Spend it in the Black Market"><dt>Funds</dt><dd>€{(team.money || 0).toLocaleString()}</dd></div>
            <div title="Higher risk lowers your Final Extraction score"><dt>Risk</dt><dd>{(team.risk || 0).toFixed(1)}</dd></div>
            <div><dt>Score</dt><dd>{Number(score || 0).toFixed(1)}</dd></div>
            <div className="p2-hide-sm"><dt>Elapsed</dt><dd>{elapsedTime(team.event_started_at, now)}</dd></div>
          </dl>
        )}

        <nav className="p2-actions" aria-label="Actions">
          {role === "team" && <>
            <button onClick={onOpenHints}>Intel</button>
            <button onClick={onOpenMarket}>Black Market</button>
          </>}
          <a href="/">Hub</a>
          <button onClick={onLogout}>Sign out</button>
        </nav>
      </div>

      {role === "team" && team && (
        <nav className="p2-tabs" aria-label="Stages">
          <button className={activeView === "dashboard" ? "on" : ""} onClick={() => setActiveView("dashboard")}>Overview</button>
          {stages.map((stage) => {
            const done = stage.status === "completed";
            const skipped = stage.status === "skipped";
            const live = stage.id === currentStage && !done && !skipped;
            const open = live || Boolean(stage.debug_unlock);
            const mark = done ? "done" : skipped ? "skipped" : live ? "now" : open ? "open" : "locked";
            return (
              <button
                key={stage.id}
                className={`${activeView === `stage${stage.id}` ? "on" : ""} ${mark}`}
                onClick={() => open && setActiveView(`stage${stage.id}`)}
                disabled={!open}
                aria-current={live ? "step" : undefined}
                title={open ? "Open this stage" : mark === "locked" ? "Locked until the previous stage is finished" : mark}
              >
                <b>{stage.id}</b> {STAGE_INFO[stage.id]?.short || stage.title}
                {mark !== "open" && mark !== "now" && <small>{mark}</small>}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
