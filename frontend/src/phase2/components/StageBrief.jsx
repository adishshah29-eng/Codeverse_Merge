import React from "react";
import { STAGE_INFO } from "../stageInfo";

// The top of every stage page: what this stage is, what to do, and what you get for it.
export default function StageBrief({ stage }) {
  const info = STAGE_INFO[stage];
  if (!info) return null;
  return (
    <section className="p2-brief">
      <p className="p2-kicker">Stage {stage} of 4 · {info.kind} · up to 10 points</p>
      <h1>{info.title}</h1>
      <p className="p2-lead">{info.goal}</p>
      <div className="p2-brief-grid">
        <div>
          <h2 className="p2-label">What to do</h2>
          <ol className="p2-steps">
            {info.steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </div>
        <div>
          <h2 className="p2-label">You get</h2>
          <p className="p2-reward">{info.reward}</p>
          {info.note && <p className="p2-note">{info.note}</p>}
        </div>
      </div>
    </section>
  );
}
