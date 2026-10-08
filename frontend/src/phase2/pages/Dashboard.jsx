import React from "react";
import { ARTIFACTS, RULES, STAGE_INFO } from "../stageInfo";

// Mission control: one clear "next move", the four stages in a list, and the keys collected so far.
export default function Dashboard({ team, stages = [], onSelectStage, onSkipStage }) {
  const currentStage = team?.current_stage || 1;
  const scores = team?.stage_scores || {};
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const finished = stages.length > 0 && stages.every((s) => ["completed", "skipped"].includes(s.status));
  const info = STAGE_INFO[currentStage];
  const outputOf = (id) => stages.find((s) => s.id === id)?.output_value;

  const skip = async () => {
    if (!window.confirm(`Skip stage ${currentStage}?\n\n• It costs 3 points.\n• The stage is marked skipped with 0 points.\n• You can't go back to it.`)) return;
    await onSkipStage(currentStage);
  };

  return (
    <div className="p2-page">
      <header className="p2-head">
        <h1>Mission control</h1>
        <p>Squad {team?.code}. Four stages stand between the crew and the exit. Finish them in order.</p>
      </header>

      {finished ? (
        <section className="p2-now">
          <p className="p2-kicker">All stages finished</p>
          <h2>Mission complete</h2>
          <p className="p2-lead">Your total is <strong>{total.toFixed(1)}</strong> points.</p>
        </section>
      ) : (
        info && (
          <section className="p2-now">
            <p className="p2-kicker">Your next move · stage {currentStage} of 4</p>
            <h2>{info.title}</h2>
            <p className="p2-lead">{info.goal}</p>
            <h3 className="p2-label">What to do</h3>
            <ol className="p2-steps">{info.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="p2-reward-line">You get: <strong>{info.reward}</strong></p>
            <div className="p2-row">
              <button className="p2-primary" onClick={() => onSelectStage(`stage${currentStage}`)}>Open stage {currentStage} →</button>
              <button className="p2-link" onClick={skip}>Skip this stage (−3 points)</button>
            </div>
          </section>
        )
      )}

      <section aria-label="Stages">
        <h2 className="p2-label">The four stages</h2>
        <ol className="p2-list">
          {stages.map((stage) => {
            const done = stage.status === "completed";
            const skipped = stage.status === "skipped";
            const live = stage.id === currentStage && !done && !skipped;
            const open = live || done || Boolean(stage.debug_unlock);
            return (
              <li key={stage.id} className={live ? "now" : ""}>
                <span className="p2-num">{stage.id}</span>
                <span className="p2-list-main">
                  <strong>{STAGE_INFO[stage.id]?.title || stage.title}</strong>
                  <small>{STAGE_INFO[stage.id]?.kind || stage.category}</small>
                </span>
                <span className="p2-list-state">
                  {done ? `Done · ${Number(scores[stage.id] ?? stage.score ?? 0).toFixed(1)} / 10`
                    : skipped ? "Skipped"
                    : live ? "In progress"
                    : open ? "Open" : "Locked"}
                </span>
                <button className="p2-ghost" disabled={!open} onClick={() => onSelectStage(`stage${stage.id}`)}>
                  {live ? "Open" : done ? "Review" : "Open"}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Keys">
        <h2 className="p2-label">Keys you need for the final stage</h2>
        <ul className="p2-keys">
          {ARTIFACTS.map((a) => {
            const value = a.stage ? outputOf(a.stage) : null;
            return (
              <li key={a.key} className={value ? "have" : ""}>
                <span>{a.name}</span>
                <code>{value || (a.stage ? `from stage ${a.stage}` : "from the market / organizers")}</code>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Rules">
        <h2 className="p2-label">How it works</h2>
        <ul className="p2-rules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
    </div>
  );
}
