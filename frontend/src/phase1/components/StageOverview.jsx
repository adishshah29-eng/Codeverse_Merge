import React from "react";
import { Check, Lock, FastForward } from "lucide-react";

// Every Phase 1 game at a glance, grouped Heist (1–5) / Arena (6–10). Locked games are shown (so teams can see
// what is coming) but can't be opened until the previous stage is finished or skipped.
const GROUPS = [
  { label: "Royal Mint Heist", ids: [1, 2, 3, 4, 5] },
  { label: "Challenge Arena", ids: [6, 7, 8, 9, 10] },
];

const split = (name = "") => {
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { title: m[1], domain: m[2] } : { title: name, domain: "" };
};

export default function StageOverview({ dashboard, activeStageId, onSelectStage }) {
  const byId = Object.fromEntries((dashboard?.stages || []).map((s) => [s.stage_id, s]));

  return (
    <section aria-label="All games" className="mb-8 space-y-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <h2 className="label mb-2 !font-sans !text-[11px]">{group.label}</h2>
          <ol className="grid grid-cols-2 md:grid-cols-5 border border-rule">
            {group.ids.map((id, index) => {
              const st = byId[id] || { status: id === 1 ? "ACTIVE" : "LOCKED", score: 0, stage_name: "" };
              const { title, domain } = split(st.stage_name);
              const isCurrent = dashboard?.current_stage === id;
              const selected = activeStageId === id;
              const locked = st.status === "LOCKED" && !isCurrent && !dashboard?.debug_unlock_all;
              const done = st.status === "COMPLETED";
              const skipped = st.status === "SKIPPED";
              return (
                <li key={id} className={index ? "border-l border-rule" : ""}>
                  <button
                    onClick={() => onSelectStage(id)}
                    disabled={locked}
                    aria-current={selected ? "step" : undefined}
                    className={`w-full h-full text-left p-3.5 flex flex-col gap-1.5 ${
                      selected ? "bg-coal-2" : "bg-coal"
                    } ${locked ? "opacity-50 cursor-not-allowed" : "hover:bg-coal-2"} border-t-2 ${
                      isCurrent ? "border-t-red" : selected ? "border-t-beige" : "border-t-transparent"
                    }`}
                  >
                    <span className="flex items-center justify-between text-[11px] font-semibold text-beige-dim">
                      <span>Game {id}</span>
                      <span className="flex items-center gap-1">
                        {done && <><Check className="w-3.5 h-3.5 text-beige" strokeWidth={3} />{Number(st.score).toFixed(1)}</>}
                        {skipped && <><FastForward className="w-3 h-3" />skipped</>}
                        {locked && <><Lock className="w-3 h-3" />locked</>}
                        {isCurrent && !done && <span className="text-red-text">in progress{Number(st.score) > 0 ? ` · ${Number(st.score).toFixed(1)}` : ""}</span>}
                      </span>
                    </span>
                    <span className="font-display text-[17px] font-semibold leading-tight text-white">{title || `Stage ${id}`}</span>
                    {domain && <span className="text-xs text-beige-dim">{domain}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
