import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, Download, Lightbulb, Send, Lock, Upload, Plus, Trash2, FileCode2, ArrowRight, Loader2,
} from "lucide-react";
import { progressApi, stageApi } from "../api";

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
    return <div className="p-6 font-mono text-sm text-rose-300">{loadError}</div>;
  }
  if (!brief) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] font-mono text-sm text-[#d4af37] gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading stage {stageId}...
      </div>
    );
  }

  const penalties = brief.hint_penalties || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-fadeIn">
      {/* ── Left: brief, handout, hints ── */}
      <div className="lg:col-span-5 space-y-4">
        <div className="glass-panel rounded-xl border border-[#23304d] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37]">
              Stage {String(stageId).padStart(2, "0")}
            </span>
            <span className="text-gray-400">{brief.domain}</span>
            <span className="px-2 py-0.5 rounded bg-[#161f33] border border-[#23304d] text-gray-300">{brief.difficulty}</span>
          </div>
          <h2 className="text-xl font-black text-white font-mono tracking-tight">{brief.title}</h2>
          <div className="text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap">{brief.brief}</div>
          <a
            href={stageApi.handoutUrl(stageId)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#b89628] text-black font-mono font-bold text-xs uppercase tracking-wider hover:from-[#e5bd3d] transition"
          >
            <Download className="w-4 h-4" /> Download handout ({brief.handout_filename})
          </a>
        </div>

        <div className="glass-panel rounded-xl border border-[#23304d] p-4 space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase text-gray-200 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" /> Hints
            <span className="text-gray-500 normal-case font-normal">— each one costs points</span>
          </h3>
          {hints.map((h) => (
            <div key={h.index} className="text-xs font-mono text-amber-200/90 bg-amber-950/20 border border-amber-500/20 rounded-lg p-2.5">
              <span className="text-amber-400 font-bold">Hint {h.index + 1}:</span> {h.text}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: brief.hints_total }).map((_, index) => {
              const unlocked = hints.some((h) => h.index === index);
              return (
                <button
                  key={index}
                  disabled={unlocked || closed}
                  onClick={() => unlockHint(index)}
                  className="px-3 py-1.5 rounded-lg border text-[11px] font-mono disabled:opacity-40 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                >
                  {unlocked ? `Hint ${index + 1} ✓` : `Unlock hint ${index + 1} (−${penalties[index] ?? 0.5})`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right: submission ── */}
      <div className="lg:col-span-7 space-y-4">
        <div className="glass-panel rounded-xl border border-[#23304d] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold uppercase text-gray-200 flex items-center gap-1.5">
              <FileCode2 className="w-3.5 h-3.5 text-[#00e5ff]" /> Your submission
            </h3>
            <div className="text-[11px] font-mono text-gray-400">
              Best so far: <span className="text-[#d4af37] font-bold">{Number(brief.score || 0).toFixed(2)}</span> / 10
              {brief.wrong_attempt_penalty > 0 && (
                <span className="text-gray-500"> · wrong answers −{brief.wrong_attempt_penalty} each</span>
              )}
            </div>
          </div>

          {closed && (
            <div className="text-xs font-mono text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2.5">
              This stage is finished ({brief.status}). Your score is locked in.
            </div>
          )}

          {spec.mode !== "none" && (
            <div className="space-y-3">
              {files.map((file, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    {spec.mode === "multi" ? (
                      <input
                        value={file.path}
                        onChange={(e) => setFile(index, { path: e.target.value })}
                        placeholder={`${spec.prefix || ""}file.py`}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#0b1220] border border-[#23304d] text-xs font-mono text-gray-100 focus:outline-none focus:border-[#00e5ff]"
                      />
                    ) : (
                      <span className="text-xs font-mono text-[#00e5ff]">{file.path}</span>
                    )}
                    {spec.mode === "multi" && (
                      <button onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="text-gray-500 hover:text-rose-400" title="Remove file">
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
                    className="w-full px-3 py-2 rounded-lg bg-[#080c14] border border-[#23304d] text-xs font-mono text-gray-100 focus:outline-none focus:border-[#00e5ff] resize-y"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#23304d] text-[11px] font-mono text-gray-300 hover:border-[#00e5ff] cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Upload {spec.mode === "multi" ? "file(s)" : spec.names?.[0]}
                  <input type="file" accept=".py,text/x-python,text/plain" multiple={spec.mode === "multi"} className="hidden" onChange={handleUpload} disabled={closed} />
                </label>
                {spec.mode === "multi" && (
                  <button
                    onClick={() => setFiles((prev) => [...prev, { path: spec.prefix || "", content: "" }])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#23304d] text-[11px] font-mono text-gray-300 hover:border-[#00e5ff]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add file
                  </button>
                )}
              </div>
            </div>
          )}

          {fields.map((field) => (
            <label key={field.key} className="block space-y-1">
              <span className="text-[11px] font-mono text-gray-400">
                {field.label}
                {field.required ? " *" : ""}
              </span>
              {field.multiline ? (
                <textarea
                  rows={3}
                  value={answers[field.key] || ""}
                  disabled={closed}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b1220] border border-[#23304d] text-xs font-mono text-gray-100 focus:outline-none focus:border-[#00e5ff]"
                />
              ) : (
                <input
                  value={answers[field.key] || ""}
                  disabled={closed}
                  autoComplete="off"
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-[#0b1220] border border-[#23304d] text-xs font-mono text-gray-100 focus:outline-none focus:border-[#00e5ff]"
                />
              )}
            </label>
          ))}

          {error && <div className="text-xs font-mono text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-lg p-2.5">{error}</div>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={submit}
              disabled={submitting || closed || !hasContent}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00b8d4] to-[#0097a7] text-black font-mono font-bold text-xs uppercase tracking-wider disabled:opacity-40 hover:brightness-110 transition"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? "Grading..." : "Submit for grading"}
            </button>
            {!closed && Number(brief.best_raw) > 0 && (
              <button
                onClick={finalize}
                disabled={finalizing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#d4af37]/60 text-[#d4af37] font-mono font-bold text-xs uppercase tracking-wider hover:bg-[#d4af37]/10 disabled:opacity-40"
              >
                <Lock className="w-4 h-4" /> Lock in score &amp; continue <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {outcome && (
          <div className={`glass-panel rounded-xl border p-4 space-y-3 animate-fadeIn ${
            outcome.passed ? "border-emerald-500/50" : outcome.success === false ? "border-rose-500/40" : "border-[#23304d]"
          }`}>
            <div className="flex items-start gap-2 text-xs font-mono">
              {outcome.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5" /> :
                outcome.success === false ? <XCircle className="w-4 h-4 text-rose-400 mt-0.5" /> : null}
              <div className="whitespace-pre-wrap text-gray-200">
                {outcome.restored && <span className="text-gray-500">Last graded submission: </span>}
                {outcome.message}
                {outcome.passed && <div className="mt-1 font-bold text-emerald-400">Stage complete — advancing…</div>}
              </div>
            </div>
            {outcome.checks?.length > 0 && (
              <table className="w-full text-[11px] font-mono">
                <tbody>
                  {outcome.checks.map((c, i) => (
                    <tr key={i} className="border-t border-[#1b2640] align-top">
                      <td className="py-1.5 pr-2 w-5">
                        {c.points < 0 ? <XCircle className="w-3.5 h-3.5 text-rose-400" /> :
                          c.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-gray-600" />}
                      </td>
                      <td className="py-1.5 pr-3 text-gray-200">
                        {c.name}
                        {c.note && <div className="text-gray-500">{c.note}</div>}
                      </td>
                      <td className="py-1.5 text-right whitespace-nowrap text-[#d4af37]">
                        {Number(c.points).toFixed(2)}{c.max ? ` / ${Number(c.max).toFixed(2)}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {outcome.breakdown && (
              <div className="text-[11px] font-mono text-gray-400 border-t border-[#1b2640] pt-2">
                Best grade {Number(outcome.breakdown.best_raw_score).toFixed(2)}
                {outcome.breakdown.hint_deduction > 0 && ` − hints ${outcome.breakdown.hint_deduction}`}
                {outcome.breakdown.attempt_deduction > 0 && ` − wrong answers ${outcome.breakdown.attempt_deduction}`}
                {" = "}<span className="text-[#d4af37] font-bold">{Number(outcome.net).toFixed(2)}</span> / 10
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
