import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, Upload, Plus, Trash2, Loader2 } from "lucide-react";
import { progressApi } from "../api";
import { stageApi } from "../api";
import HandoutFiles from "../components/HandoutFiles";

// One screen for all five Phase 1 challenges. The server describes the stage (brief, what to submit,
// hints) and grades every submission; this component only collects files/answers and shows the result.

const DRAFT_KEY = (stageId) => `cv-phase1-draft-${stageId}`;

function loadDraft(stageId) {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY(stageId)) || "null");
  } catch {
    return null;
  }
}

function saveDraft(stageId, draft) {
  try {
    localStorage.setItem(DRAFT_KEY(stageId), JSON.stringify(draft));
  } catch {
    /* private mode / quota: drafts are a convenience only */
  }
}

const newKey = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function initialFiles(submit) {
  const spec = submit?.files || { mode: "none" };
  if (spec.mode === "none") return [];
  return (spec.names || []).map((path) => ({ path, content: "" }));
}

// The server sends the brief as plain text. Show it as short paragraphs, real bullet lists and a separate scoring note
// instead of one wall of text.
function BriefText({ text }) {
  const blocks = (text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="mt-4 space-y-3 text-[14.5px] leading-relaxed text-ink/90">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim());
        const bullets = lines.filter((l) => /^[•\-]/.test(l));
        if (/^Scoring/i.test(block)) {
          return (
            <p key={i} className="border-t border-ink/25 pt-3 text-[13px] text-ink/70">{block}</p>
          );
        }
        if (bullets.length === lines.length) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, j) => <li key={j}>{l.replace(/^[•\-]\s*/, "")}</li>)}
            </ul>
          );
        }
        const intro = lines.filter((l) => !/^[•\-]/.test(l)).join(" ");
        return (
          <div key={i}>
            {intro && <p>{intro}</p>}
            {bullets.length > 0 && (
              <ul className="mt-1.5 list-disc pl-5 space-y-1">
                {bullets.map((l, j) => <li key={j}>{l.replace(/^[•\-]\s*/, "")}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChallengeStage({ stageId, onStageComplete, onRefresh }) {
  const [brief, setBrief] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [files, setFiles] = useState([]);
  const [answers, setAnswers] = useState({});
  const [hints, setHints] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBrief(null);
    setOutcome(null);
    setError("");
    setLoadError("");
    try {
      const data = await stageApi.getBrief(stageId);
      setBrief(data);
      setHints(data.unlocked_hints || []);
      const draft = loadDraft(stageId);
      setFiles(draft?.files?.length ? draft.files : initialFiles(data.submit));
      setAnswers(draft?.answers || {});
      if (data.last_checks?.length) {
        setOutcome({ message: data.last_message, checks: data.last_checks, best_raw: data.best_raw, restored: true });
      }
    } catch (err) {
      setLoadError(err.message || "Could not load this stage.");
    }
  }, [stageId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (brief) saveDraft(stageId, { files, answers });
  }, [files, answers, brief, stageId]);

  const spec = brief?.submit?.files || { mode: "none" };
  const fields = brief?.submit?.fields || [];
  const closed = brief && brief.status !== "ACTIVE";

  const hasContent = useMemo(
    () => files.some((f) => f.content.trim()) || Object.values(answers).some((v) => (v || "").trim()),
    [files, answers],
  );

  const setFile = (index, patch) => setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const handleUpload = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    for (const file of picked) {
      const content = await file.text();
      if (spec.mode === "single") {
        setFiles([{ path: spec.names[0], content }]);
        break;
      }
      const path = `${spec.prefix || ""}${file.name}`;
      setFiles((prev) => {
        const existing = prev.findIndex((f) => f.path === path);
        return existing >= 0 ? prev.map((f, i) => (i === existing ? { ...f, content } : f)) : [...prev, { path, content }];
      });
    }
  };

  // "Use in editor" from the handout viewer: put a handout file into the submission editor.
  const useInEditor = (path, content) => {
    if (spec.mode === "single") {
      setFiles([{ path: spec.names[0], content }]);
    } else {
      setFiles((prev) => {
        const existing = prev.findIndex((f) => f.path === path);
        return existing >= 0 ? prev.map((f, i) => (i === existing ? { ...f, content } : f)) : [...prev, { path, content }];
      });
    }
    document.getElementById("submission-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const unlockHint = async (index) => {
    setError("");
    try {
      const res = await progressApi.unlockHint(stageId, index);
      setHints((prev) => (prev.some((h) => h.index === index) ? prev : [...prev, { index, text: res.text }].sort((a, b) => a.index - b.index)));
      onRefresh && onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payloadFiles = {};
      files.forEach((f) => {
        if (f.path.trim() && f.content.trim()) payloadFiles[f.path.trim()] = f.content;
      });
      const res = await stageApi.submit(stageId, { idempotency_key: newKey(), files: payloadFiles, answers });
      const fb = res.feedback || {};
      setOutcome({
        message: res.message, success: res.success, passed: res.passed, checks: fb.checks || [],
        raw: fb.raw_score, best_raw: fb.best_raw, net: fb.net_score ?? res.total_stage_score, breakdown: fb.breakdown,
      });
      onRefresh && onRefresh();
      if (res.passed) {
        setTimeout(() => onStageComplete(res.next_stage), 2500);
      } else {
        setBrief((prev) => (prev ? { ...prev, best_raw: fb.best_raw ?? prev.best_raw, score: fb.net_score ?? prev.score } : prev));
      }
    } catch (err) {
      setError(err.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = async () => {
    if (!window.confirm("Lock in your current best score and move on? You can't come back to this stage.")) return;
    setFinalizing(true);
    setError("");
    try {
      const res = await stageApi.finalize(stageId);
      onRefresh && onRefresh();
      onStageComplete(res.next_stage);
    } catch (err) {
      setError(err.message || "Could not finalize.");
    } finally {
      setFinalizing(false);
    }
  };

  if (loadError) {
    return <div className="p-6 text-sm text-red-text">{loadError}</div>;
  }
  if (!brief) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-beige-dim gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading stage {stageId}…
      </div>
    );
  }

  const penalties = brief.hint_penalties || [];
  const field = "w-full px-3 py-2 rounded-sm border border-rule bg-coal-well text-sm text-beige focus:outline-none focus:border-beige";
  const ghostBtn = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-beige-dim text-[13px] font-medium text-beige hover:bg-beige hover:text-ink disabled:opacity-40";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-x-8 gap-y-6 animate-rise">
      {/* ── Reading column ── */}
      <div className="lg:col-span-5 space-y-4">
        <section className="paper p-6 rounded-sm">
          <p className="label !text-[#5c5047]">{brief.domain} · {brief.difficulty}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-ink">{brief.title}</h2>
          <BriefText text={brief.brief} />
        </section>

        <HandoutFiles stageId={stageId} spec={spec} disabled={closed} onUse={useInEditor} />

        <details className="group border border-rule bg-coal">
          <summary className="flex items-center justify-between cursor-pointer select-none px-4 py-3 text-sm text-beige list-none">
            <span>Hints <span className="text-beige-faint">· {hints.length} of {brief.hints_total} used · each costs points</span></span>
            <span className="text-beige-dim group-open:rotate-90 transition-transform" aria-hidden="true">›</span>
          </summary>
          <div className="px-4 pb-4 space-y-3 border-t border-rule pt-3">
            {hints.map((h) => (
              <p key={h.index} className="text-sm border-l-2 border-red pl-3 text-beige">
                <span className="font-semibold text-white">Hint {h.index + 1}.</span> {h.text}
              </p>
            ))}
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: brief.hints_total }).map((_, index) => {
                const unlocked = hints.some((h) => h.index === index);
                if (unlocked) return null;
                return (
                  <button key={index} disabled={closed} onClick={() => unlockHint(index)} className={ghostBtn}>
                    Reveal hint {index + 1} <span className="text-beige-dim">−{penalties[index] ?? 0.5}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      </div>

      {/* ── Doing column ── */}
      <div className="lg:col-span-7 space-y-4">
        <section id="submission-editor" className="bg-coal border border-rule border-t-4 border-t-red p-5 space-y-5">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-xl font-semibold text-white">Your submission</h3>
            <p className="text-sm text-beige-dim">
              Best so far <span className="font-display text-2xl font-semibold text-white tabular-nums align-middle">{Number(brief.score || 0).toFixed(2)}</span> / 10
            </p>
          </div>
          {brief.wrong_attempt_penalty > 0 && (
            <p className="text-xs text-beige-dim -mt-3">Wrong answers cost {brief.wrong_attempt_penalty} each — don’t guess.</p>
          )}

          {closed && (
            <p className="text-sm border-l-2 border-beige pl-3 text-beige">This stage is finished ({brief.status.toLowerCase()}). Your score is locked in.</p>
          )}

          {spec.mode !== "none" && (
            <div className="space-y-4">
              {files.map((file, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {spec.mode === "multi" ? (
                      <input
                        value={file.path}
                        onChange={(e) => setFile(index, { path: e.target.value })}
                        placeholder={`${spec.prefix || ""}file.py`}
                        className={`${field} font-mono text-[13px] flex-1`}
                      />
                    ) : (
                      <span className="font-mono text-[13px] font-medium text-beige">{file.path}</span>
                    )}
                    {spec.mode === "multi" && (
                      <button onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="p-1.5 text-beige-dim hover:text-red-text" title="Remove file" aria-label="Remove file">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <textarea
                    value={file.content}
                    onChange={(e) => setFile(index, { content: e.target.value })}
                    spellCheck={false}
                    disabled={closed}
                    rows={spec.mode === "single" ? 18 : 10}
                    placeholder="Paste your code here, or use Upload."
                    className="code-surface w-full px-3.5 py-3 rounded-sm resize-y"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <label className={`${ghostBtn} cursor-pointer`}>
                  <Upload className="w-3.5 h-3.5" /> Upload {spec.mode === "multi" ? "files" : spec.names?.[0]}
                  <input type="file" accept=".py,text/x-python,text/plain" multiple={spec.mode === "multi"} className="hidden" onChange={handleUpload} disabled={closed} />
                </label>
                {spec.mode === "multi" && (
                  <button onClick={() => setFiles((prev) => [...prev, { path: spec.prefix || "", content: "" }])} className={ghostBtn}>
                    <Plus className="w-3.5 h-3.5" /> Add file
                  </button>
                )}
              </div>
            </div>
          )}

          {fields.map((f) => (
            <label key={f.key} className="block space-y-1.5">
              <span className="text-sm font-medium text-beige">
                {f.label}
                {f.required ? <span className="text-red-text"> *</span> : <span className="text-beige-faint font-normal"> (optional)</span>}
              </span>
              {f.multiline ? (
                <textarea rows={3} value={answers[f.key] || ""} disabled={closed}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))} className={field} />
              ) : (
                <input value={answers[f.key] || ""} disabled={closed} autoComplete="off"
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [f.key]: e.target.value }))} className={`${field} font-mono text-[13px]`} />
              )}
            </label>
          ))}

          {error && <p role="alert" className="text-sm border-l-2 border-red bg-red-deep pl-3 py-2 text-red-text">{error}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={submit}
              disabled={submitting || closed || !hasContent}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-sm bg-red text-white text-sm font-semibold hover:bg-red-hover disabled:opacity-40"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "Grading…" : "Submit for grading"}
            </button>
            {!closed && Number(brief.best_raw) > 0 && (
              <button onClick={finalize} disabled={finalizing} className={ghostBtn}>
                Lock in {Number(brief.score || 0).toFixed(2)} and continue →
              </button>
            )}
          </div>
        </section>

        {outcome && (
          <section className="bg-coal border border-beige-dim p-5 space-y-4 animate-rise" aria-live="polite">
            <p className={`text-[15px] font-medium whitespace-pre-wrap ${outcome.success === false ? "text-red-text" : "text-beige"}`}>
              {outcome.restored && <span className="label block mb-1">Last graded submission</span>}
              {outcome.message}
              {outcome.passed && <span className="block mt-1 text-sm font-semibold">Stage complete — moving on…</span>}
            </p>
            {outcome.checks?.length > 0 && (
              <table className="w-full text-sm">
                <tbody>
                  {outcome.checks.map((c, i) => (
                    <tr key={i} className="border-t border-rule align-top">
                      <td className="py-2 pr-3 w-6">
                        {c.points < 0 || !c.passed ? <X className="w-4 h-4 text-red-text" strokeWidth={2.5} /> : <Check className="w-4 h-4 text-beige" strokeWidth={3} />}
                      </td>
                      <td className="py-2 pr-4 text-beige">
                        {c.name}
                        {c.note && <div className="text-[13px] text-beige-dim">{c.note}</div>}
                      </td>
                      <td className="py-2 text-right whitespace-nowrap tabular-nums font-medium text-white">
                        {Number(c.points).toFixed(2)}
                        {c.max ? <span className="text-beige-faint font-normal"> / {Number(c.max).toFixed(2)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {outcome.breakdown && (
              <p className="text-[13px] text-beige-dim border-t border-rule pt-3">
                Best grade {Number(outcome.breakdown.best_raw_score).toFixed(2)}
                {outcome.breakdown.hint_deduction > 0 && ` − hints ${outcome.breakdown.hint_deduction}`}
                {outcome.breakdown.attempt_deduction > 0 && ` − wrong answers ${outcome.breakdown.attempt_deduction}`}
                {" = "}<span className="font-display text-lg font-semibold text-white">{Number(outcome.net).toFixed(2)}</span> / 10
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
