import React, { useEffect, useState } from "react";
import {
  Activity,
  CircleDollarSign,
  Clock3,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  ShieldAlert,
  Store,
  Trophy,
} from "lucide-react";

function elapsedTime(startedAt, now) {
  if (!startedAt) return "--:--:--";
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const hours = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function Navbar({
  team,
  role,
  stages = [],
  activeView,
  setActiveView,
  onOpenMarket,
  onOpenHints,
  onLogout,
}) {
  const [now, setNow] = useState(Date.now());
  const currentStage = team?.current_stage || 1;
  const score = team?.final_score ?? Object.values(team?.stage_scores || {}).reduce((sum, value) => sum + value, 0);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <header className="command-header">
      <div className="command-header-main">
        <button
          className="command-brand"
          onClick={() => setActiveView(role === "admin" ? "admin" : "dashboard")}
          aria-label="Open command dashboard"
        >
          <span className="command-mark"><Activity size={21} strokeWidth={2.2} /></span>
          <span className="command-brand-copy">
            <strong>LA CASA DE PAPEL <i>/</i> COMMAND</strong>
            <small><span className="signal-dot" /> OPERATION FUGA · SECURE CONTROL ROOM</small>
          </span>
        </button>

        {role === "team" && team && (
          <div className="command-team">
            <span>CREW IDENT</span>
            <strong>{team.code}</strong>
            <small>{team.name}</small>
          </div>
        )}

        <div className="command-actions">
          {role === "team" && <>
            <button className="icon-command" onClick={onOpenMarket} title="Open black market" aria-label="Open black market"><Store size={17} /></button>
            <button className="icon-command" onClick={onOpenHints} title="Open intelligence" aria-label="Open intelligence"><Lightbulb size={17} /></button>
          </>}
          {role === "admin" && <span className="command-admin"><ShieldAlert size={15} /> ORGANIZER COMMAND</span>}
          <button className="icon-command logout-command" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={17} /></button>
        </div>
      </div>

      {role === "team" && team && <>
        <div className="command-readouts" aria-label="Persistent mission telemetry">
          <div className="readout"><CircleDollarSign size={16} /><span>FUNDS</span><strong>{(team.money || 0).toLocaleString()}</strong></div>
          <div className="readout risk-readout"><ShieldAlert size={16} /><span>RISK</span><strong>{(team.risk || 0).toFixed(1)}</strong></div>
          <div className="readout time-readout"><Clock3 size={16} /><span>ELAPSED</span><strong>{elapsedTime(team.event_started_at, now)}</strong></div>
          <div className="readout score-readout"><Trophy size={16} /><span>SCORE</span><strong>{Number(score || 0).toFixed(1)}</strong></div>
        </div>

        <nav className="mission-timeline" aria-label="Heist stage progression">
          <button
            className={`timeline-home ${activeView === "dashboard" ? "selected" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <LayoutDashboard size={15} /> OVERVIEW
          </button>
          <div className="timeline-track">
            {stages.map((stage) => {
              const isCurrent = stage.id === currentStage && !["completed", "skipped"].includes(stage.status);
              const isAvailable = stage.id === currentStage && isCurrent;
              const state = stage.status === "completed" ? "complete" : stage.status === "skipped" ? "skipped" : isCurrent ? "active" : "locked";
              return (
                <button
                  key={stage.id}
                  className={`timeline-stage ${state} ${activeView === `stage${stage.id}` ? "selected" : ""}`}
                  onClick={() => isAvailable && setActiveView(`stage${stage.id}`)}
                  disabled={!isAvailable}
                  aria-current={isCurrent ? "step" : undefined}
                  title={isAvailable ? "Enter active stage" : `${state.toUpperCase()}: ${stage.title}`}
                >
                  <span className="timeline-node">{String(stage.id).padStart(2, "0")}</span>
                  <span className="timeline-label">{stage.title.split("—")[1]?.trim() || stage.title}</span>
                  <small>{state === "active" ? "LIVE" : state.toUpperCase()}</small>
                </button>
              );
            })}
          </div>
        </nav>
      </>}
    </header>
  );
}
