import React from "react";
import { Check, FastForward, Lock } from "lucide-react";

// The only stage navigation: ten numbered ticks (Heist 1–5 | Arena 6–10) and the name of the open game.
const GROUPS = [
  { label: "Heist", ids: [1, 2, 3, 4, 5] },
  { label: "Arena", ids: [6, 7, 8, 9, 10] },
];

const short = (name = "") => name.replace(/\s*\(.*\)\s*$/, "");

export default function StageBar({ dashboard, activeStageId, onSelectStage }) {
  const byId = Object.fromEntries((dashboard?.stages || []).map((s) => [s.stage_id, s]));
  const active = byId[activeStageId];

  return (
    <div className="sticky top-0 z-40 bg-ink/95 border-b border-rule">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-8 gap-y-2">
        <nav aria-label="Games" className="flex items-center gap-4">
          {GROUPS.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && <span className="h-5 w-px bg-rule" aria-hidden="true" />}
              <ol className="flex items-center gap-1" aria-label={group.label}>
                {group.ids.map((id) => {
                  const st = byId[id] || { status: id === 1 ? "ACTIVE" : "LOCKED" };
                  const off = st.enabled === false;
                  const isCurrent = dashboard?.current_stage === id && !off;
                  const selected = activeStageId === id;
                  const locked = off || (st.status === "LOCKED" && !isCurrent && !dashboard?.unlock_all);
                  const done = st.status === "COMPLETED" && !off;
                  const skipped = st.status === "SKIPPED" && !off;
                  const state = off ? "switched off" : done ? `done, ${Number(st.score).toFixed(1)} points` : skipped ? "skipped" : locked ? "locked" : isCurrent ? "in progress" : "open";
                  let tone = "text-beige-dim border-transparent hover:text-white hover:border-rule";
                  if (done) tone = "text-beige border-transparent hover:border-rule";
                  if (isCurrent) tone = "text-white bg-red border-red";
                  if (selected && !isCurrent) tone = "text-white border-beige";
                  return (
                    <li key={id}>
                      <button
                        onClick={() => onSelectStage(id)}
                        disabled={locked}
                        aria-current={selected ? "page" : undefined}
                        title={`Game ${id} · ${short(st.stage_name)} — ${state}`}
                        className={`w-8 h-8 flex items-center justify-center text-[13px] font-semibold border rounded-sm ${tone} ${locked ? "opacity-35 cursor-not-allowed hover:!border-transparent hover:!text-beige-dim" : ""}`}
                      >
                        {off ? <span className="line-through">{id}</span> : done ? <Check className="w-4 h-4" strokeWidth={3} /> : skipped ? <FastForward className="w-3.5 h-3.5" /> : locked ? <Lock className="w-3 h-3" /> : id}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </React.Fragment>
          ))}
        </nav>

        {active && (
          <p className="text-sm text-beige-dim min-w-0 truncate">
            <span className="text-beige-faint">{activeStageId <= 5 ? "Heist" : "Arena"} · Game {activeStageId} ·</span>{" "}
            <span className="text-white">{short(active.stage_name)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
