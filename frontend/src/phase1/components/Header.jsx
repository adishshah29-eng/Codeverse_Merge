import React, { useState, useEffect } from "react";
import { Check, Lock, FastForward } from "lucide-react";

// Black bar across the top: wordmark, a two-group stage stepper, the running score, and plain text actions.
const GROUPS = [
  { label: "Heist", ids: [1, 2, 3, 4, 5] },
  { label: "Arena", ids: [6, 7, 8, 9, 10] },
];

const pad = (n) => String(n).padStart(2, "0");
const formatTimer = (total) => {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(total % 60)}` : `${pad(m)}:${pad(total % 60)}`;
};

const labelCls = "text-[10px] font-semibold uppercase tracking-wider text-beige-faint";

export default function Header({
  team,
  dashboard,
  onOpenDashboard,
  onOpenLeaderboard,
  onOpenAdmin,
  onLogout,
  onSelectStage,
  activeStageId,
}) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const byId = Object.fromEntries((dashboard?.stages || []).map((s) => [s.stage_id, s]));
  const totalScore = dashboard?.total_score || 0;
  const rank = dashboard?.rank ? `#${dashboard.rank}` : "–";
  const action = "px-3 py-1.5 text-[13px] font-medium text-beige hover:text-white hover:bg-coal-2 rounded-sm";

  return (
    <header className="sticky top-0 z-50 bg-ink border-b border-rule">
      <div className="h-[3px] bg-red" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="min-w-0">
          <div className="font-display text-xl font-semibold leading-none text-white">
            Codeverse <span className="text-red-text italic font-medium">Phase 1</span>
          </div>
          <div className="mt-1 text-xs text-beige-dim truncate">{team?.name || "Team"}</div>
        </div>

        <nav aria-label="Stages" className="flex flex-wrap items-end gap-x-6 gap-y-2">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className={`${labelCls} mb-1`}>{group.label}</div>
              <ol className="flex gap-1">
                {group.ids.map((id) => {
                  const st = byId[id] || { status: id === 1 ? "ACTIVE" : "LOCKED" };
                  const isCurrent = dashboard?.current_stage === id;
                  const selected = activeStageId === id;
                  const locked = st.status === "LOCKED" && !isCurrent && !dashboard?.unlock_all;
                  const done = st.status === "COMPLETED";
                  const skipped = st.status === "SKIPPED";
                  let tone = "border-rule text-beige-faint";
                  if (isCurrent) tone = "border-red bg-red text-white";
                  else if (done) tone = "border-beige text-beige";
                  else if (skipped) tone = "border-rule text-beige-faint";
                  return (
                    <li key={id}>
                      <button
                        onClick={() => onSelectStage(id)}
                        disabled={locked}
                        aria-current={selected ? "step" : undefined}
                        title={`Stage ${id}: ${st.stage_name || ""} (${st.status.toLowerCase()})`}
                        className={`w-9 h-8 flex items-center justify-center text-[13px] font-semibold border rounded-sm ${tone} ${
                          locked ? "opacity-40 cursor-not-allowed" : "hover:border-white hover:text-white"
                        } ${selected ? "outline outline-2 outline-offset-2 outline-beige" : ""}`}
                      >
                        {done ? <Check className="w-4 h-4" strokeWidth={3} /> : skipped ? <FastForward className="w-3.5 h-3.5" /> : locked ? <Lock className="w-3 h-3" /> : id}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-end gap-6">
            <div>
              <div className={labelCls}>Score</div>
              <div className="font-display text-2xl font-semibold leading-none text-white tabular-nums">
                {totalScore.toFixed(1)}
                <span className="text-sm text-beige-faint font-sans font-normal"> / 100</span>
              </div>
            </div>
            <div className="hidden sm:block">
              <div className={labelCls}>Rank</div>
              <div className="font-display text-2xl font-semibold leading-none text-white">{rank}</div>
            </div>
            <div className="hidden md:block">
              <div className={labelCls}>Session</div>
              <div className="text-sm tabular-nums text-beige leading-6">{formatTimer(seconds)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 border-l border-rule pl-4">
            <button onClick={onOpenDashboard} className={action}>Dashboard</button>
            <button onClick={onOpenLeaderboard} className={action}>Leaderboard</button>
            <a href="/" className={action}>Hub</a>
            {onOpenAdmin && <button onClick={onOpenAdmin} className={action}>Admin</button>}
            <button onClick={onLogout} className={`${action} !text-red-text`}>Sign out</button>
          </div>
        </div>
      </div>
    </header>
  );
}
