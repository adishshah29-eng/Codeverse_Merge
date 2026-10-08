import React, { useCallback, useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Check, X, Copy, RefreshCw, Send, Lock, Loader2, Download, Terminal, Code2, Plus, Lightbulb } from "lucide-react";
import { progressApi, stageApi } from "../api";

// Stages 6–10 use the same workspace as the Alarm System: a banner, a code editor that already holds the handout's
// starter code (every other handout file is a read-only tab), and a right-hand column with the objectives, hints and
// an output console. The server grades every submission.

const LANG = { py: "python", md: "markdown", ini: "ini", json: "json", c: "c", sh: "shell" };
const langOf = (path) => LANG[path.split(".").pop()] || "plaintext";
const DRAFT_KEY = (stageId) => `cv-phase1-draft-v2-${stageId}`;
const newKey = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

function readDraft(stageId) {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY(stageId)) || "{}");
  } catch {
    return {};
  }
}
function writeDraft(stageId, docs) {
  try {
    const out = {};
    docs.filter((d) => d.editable).forEach((d) => { out[d.path] = d.content; });
    localStorage.setItem(DRAFT_KEY(stageId), JSON.stringify({ files: out }));
  } catch {
    /* drafts are only a convenience */
  }
}

// The brief arrives as plain text; show it as paragraphs, real bullets and a separate scoring note.
function BriefText({ text, skipFirst = false }) {
  let blocks = (text || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (skipFirst) blocks = blocks.slice(1);
  return (
    <div className="space-y-3 text-[13.5px] leading-relaxed text-beige">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim());
        const isBullet = (l) => /^[•-]/.test(l);
        if (/^Scoring/i.test(block)) {
          return <p key={i} className="border-t border-rule pt-3 text-[12.5px] text-beige-dim">{block}</p>;
        }
        const intro = lines.filter((l) => !isBullet(l)).join(" ");
        const bullets = lines.filter(isBullet);
        return (
          <div key={i}>
            {intro && <p>{intro}</p>}
            {bullets.length > 0 && (
              <ul className="mt-1.5 list-disc pl-5 space-y-1">
                {bullets.map((l, j) => <li key={j}>{l.replace(/^[•-]\s*/, "")}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChallengeStage({ stageId, dashboard, onStageComplete, onRefresh }) {
  const [brief, setBrief] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [docs, setDocs] = useState([]);
  const [binaries, setBinaries] = useState([]);
  const [activePath, setActivePath] = useState("");
  const [answers, setAnswers] = useState({});
  const [hints, setHints] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setBrief(null); setDocs([]); setBinaries([]); setOutcome(null); setError(""); setLoadError("");
    try {
      const data = await stageApi.getBrief(stageId);
      const listing = await stageApi.listFiles(stageId);
      const spec = data.submit?.files || { mode: "none" };
      const starters = listing.starters || {};
      const textFiles = listing.files.filter((f) => f.kind === "text");
      const loaded = await Promise.all(
        textFiles.map((f) => stageApi.readFile(stageId, f.path).then((r) => [f.path, r.content]).catch(() => [f.path, "# could not load this file"])),
      );
      const byPath = Object.fromEntries(loaded);
      const draft = readDraft(stageId).files || {};

      // Editable files = what the team submits. They start as the handout's starter code (or the saved draft).
      let editablePaths = [];
      if (spec.mode === "single") editablePaths = [spec.names[0]];
      if (spec.mode === "multi") editablePaths = textFiles.map((f) => f.path).filter((p) => spec.names?.includes(p) || (spec.prefix && p.startsWith(spec.prefix)));
      const sourceOf = (path) => Object.keys(starters).find((src) => starters[src] === path) || path;
      const hidden = new Set(editablePaths.map(sourceOf).filter((src) => !editablePaths.includes(src)));

      const next = editablePaths.map((path) => {
        const original = byPath[sourceOf(path)] ?? "";
        return { path, original, content: draft[path] ?? original, editable: true };
      });
      Object.keys(draft).filter((p) => !editablePaths.includes(p) && spec.mode === "multi").forEach((p) => next.push({ path: p, original: "", content: draft[p], editable: true }));
      textFiles.forEach((f) => {
        if (!editablePaths.includes(f.path) && !hidden.has(f.path)) next.push({ path: f.path, original: byPath[f.path], content: byPath[f.path], editable: false });
      });

      setBrief(data);
      setHints(data.unlocked_hints || []);
      setDocs(next);
      setBinaries(listing.files.filter((f) => f.kind !== "text"));
      setActivePath(next[0]?.path || "");
      if (data.last_checks?.length) {
        setOutcome({ message: data.last_message, checks: data.last_checks, restored: true });
      }
    } catch (err) {
      setLoadError(err.message || "Could not load this stage.");
    }
  }, [stageId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (brief && docs.length) writeDraft(stageId, docs); }, [docs, brief, stageId]);

  const spec = brief?.submit?.files || { mode: "none" };
  const fields = brief?.submit?.fields || [];
  const closed = brief && brief.status !== "ACTIVE" && !dashboard?.debug_unlock_all;
  const active = docs.find((d) => d.path === activePath);
  const hasEditor = spec.mode !== "none";

  const setContent = (path, content) => setDocs((prev) => prev.map((d) => (d.path === path ? { ...d, content } : d)));

  const addFile = () => {
    const path = (window.prompt(`File path (under ${spec.prefix || ""})`, spec.prefix || "") || "").trim();
    if (!path || docs.some((d) => d.path === path)) return;
    setDocs((prev) => [...prev, { path, original: "", content: "", editable: true }]);
    setActivePath(path);
  };

  const copyActive = async () => {
    try {
      await navigator.clipboard.writeText(active?.content || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard unavailable */ }
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

  const hasContent = useMemo(
    () => docs.some((d) => d.editable && d.content.trim()) || Object.values(answers).some((v) => (v || "").trim()),
    [docs, answers],
  );

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const files = {};
      docs.filter((d) => d.editable && d.path.trim() && d.content.trim()).forEach((d) => { files[d.path.trim()] = d.content; });
      const res = await stageApi.submit(stageId, { idempotency_key: newKey(), files, answers });
      const fb = res.feedback || {};
      setOutcome({
        message: res.message, success: res.success, passed: res.passed, checks: fb.checks || [],
        best_raw: fb.best_raw, net: fb.net_score ?? res.total_stage_score, breakdown: fb.breakdown,
      });
      onRefresh && onRefresh();
      if (res.passed) setTimeout(() => onStageComplete(res.next_stage), 2500);
      else setBrief((prev) => (prev ? { ...prev, best_raw: fb.best_raw ?? prev.best_raw, score: fb.net_score ?? prev.score } : prev));
    } catch (err) {
      setError(err.message || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const finalize = async () => {
    if (!window.confirm("Lock in your current best score and move on? You can't come back to this stage.")) return;
    setFinalizing(true); setError("");
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

  if (loadError) return <div className="p-6 text-sm text-red-text">{loadError}</div>;
  if (!brief) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-sm text-beige-dim gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading stage {stageId}…
      </div>
    );
  }

  const penalties = brief.hint_penalties || [];
  const lead = (brief.brief.split(/\n\s*\n/)[0] || "").replace(/\s+/g, " ").trim();
  const btn = "px-2.5 py-1 rounded-sm border border-rule bg-coal hover:bg-coal-2 text-[11px] text-beige flex items-center gap-1 disabled:opacity-40";
  const field = "w-full px-3 py-2 rounded-sm border border-rule bg-coal-well text-sm text-beige focus:outline-none focus:border-beige";

  return (
    <div className="space-y-5 animate-rise">
      {/* Banner */}
      <div className="p-5 border border-rule border-t-[3px] border-t-red bg-coal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="label">Stage {String(stageId).padStart(2, "0")} · {brief.domain} · {brief.difficulty}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">{brief.title}</h2>
          <p className="mt-1 text-sm text-beige-dim max-w-3xl">{lead.length > 240 ? `${lead.slice(0, 237)}…` : lead}</p>
        </div>
        <div className="shrink-0 px-4 py-2 border border-rule text-center">
          <div className="label">Best so far</div>
          <div className="font-display text-xl font-semibold text-white tabular-nums">{Number(brief.score || 0).toFixed(2)} <span className="text-sm text-beige-faint font-sans font-normal">/ 10</span></div>
        </div>
      </div>

      {closed && <p className="text-sm border-l-2 border-beige pl-3 text-beige">This stage is finished ({brief.status.toLowerCase()}). Your score is locked in.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Workspace (8 cols) ── */}
        <div className="lg:col-span-8 space-y-4">
          {hasEditor ? (
            <div className="border border-rule bg-coal overflow-hidden flex flex-col h-[560px]">
              {/* File tabs */}
              <div className="flex items-end gap-px bg-coal-well border-b border-rule overflow-x-auto">
                {docs.map((d) => (
                  <button
                    key={d.path}
                    onClick={() => setActivePath(d.path)}
                    className={`px-3.5 py-2 text-xs font-mono whitespace-nowrap border-t-2 ${
                      d.path === activePath ? "bg-coal text-white border-t-red" : "text-beige-dim border-t-transparent hover:text-white"
                    }`}
                  >
                    {d.path}{!d.editable && <span className="ml-1.5 text-[10px] text-beige-faint font-sans">read-only</span>}
                  </button>
                ))}
                {spec.mode === "multi" && !closed && (
                  <button onClick={addFile} className="px-3 py-2 text-beige-dim hover:text-white" title="Add a file" aria-label="Add a file">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-2 bg-coal-well border-b border-rule">
                <div className="flex items-center gap-2 text-xs text-beige">
                  <Code2 className="w-4 h-4 text-beige-dim" />
                  <span className="font-mono font-semibold">{active?.path || "—"}</span>
                  {active && !active.editable && <span className="text-[10px] px-1.5 py-0.5 border border-rule text-beige-dim">read-only handout file</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={copyActive} className={btn}>
                    {copied ? <Check className="w-3 h-3" strokeWidth={3} /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                  </button>
                  {active?.editable && (
                    <button type="button" onClick={() => setContent(active.path, active.original)} className={btn} title="Back to the handout's starter code">
                      <RefreshCw className="w-3 h-3" /> Reset
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting || closed || !hasContent}
                    className="px-4 py-1 rounded-sm bg-red hover:bg-red-hover text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {submitting ? "Grading…" : "Submit for grading"}
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-coal-well">
                {active ? (
                  <Editor
                    height="100%"
                    path={active.path}
                    language={langOf(active.path)}
                    theme="vs-dark"
                    value={active.content}
                    onChange={(val) => active.editable && setContent(active.path, val || "")}
                    options={{
                      fontSize: 13,
                      fontFamily: "JetBrains Mono, monospace",
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      lineNumbers: "on",
                      readOnly: !active.editable || closed,
                      wordWrap: active.path.endsWith(".md") || active.path.endsWith(".csv") ? "on" : "off",
                    }}
                  />
                ) : <div className="p-6 text-sm text-beige-dim">No files for this stage.</div>}
              </div>
            </div>
          ) : (
            <div className="border border-rule bg-coal p-5 space-y-3">
              <h3 className="label">Binaries</h3>
              {binaries.map((f) => (
                <a key={f.path} href={stageApi.fileUrl(stageId, f.path)}
                   className="flex items-center justify-between gap-3 px-4 py-3 border border-rule hover:bg-coal-2 text-beige">
                  <span className="font-mono text-sm">{f.path}</span>
                  <span className="flex items-center gap-2 text-xs text-beige-dim"><Download className="w-4 h-4" /> {(f.size / 1024).toFixed(0)} KB</span>
                </a>
              ))}
              <p className="text-xs text-beige-dim">Linux x86-64. Make them executable (<span className="font-mono">chmod +x</span>) and only run them on a machine you own.</p>
            </div>
          )}

          {/* Answers / notes */}
          {fields.length > 0 && (
            <div className="border border-rule bg-coal p-5 space-y-4">
              <h3 className="label">{hasEditor ? "Notes" : "Your answers"}</h3>
              {fields.map((f) => (
                <label key={f.key} className="block space-y-1.5">
                  <span className="text-sm font-medium text-beige">
                    {f.label}{f.required ? <span className="text-red-text"> *</span> : <span className="text-beige-faint font-normal"> (optional)</span>}
                  </span>
                  {f.multiline ? (
                    <textarea rows={3} value={answers[f.key] || ""} disabled={closed}
                      onChange={(e) => setAnswers((p) => ({ ...p, [f.key]: e.target.value }))} className={field} />
                  ) : (
                    <input value={answers[f.key] || ""} disabled={closed} autoComplete="off"
                      onChange={(e) => setAnswers((p) => ({ ...p, [f.key]: e.target.value }))} className={`${field} font-mono text-[13px]`} />
                  )}
                </label>
              ))}
              {!hasEditor && (
                <button onClick={submit} disabled={submitting || closed || !hasContent}
                  className="px-5 py-2 rounded-sm bg-red hover:bg-red-hover text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-2">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {submitting ? "Checking…" : "Submit answers"}
                </button>
              )}
              {brief.wrong_attempt_penalty > 0 && <p className="text-xs text-beige-dim">Wrong answers cost {brief.wrong_attempt_penalty} each — don’t guess.</p>}
            </div>
          )}
          {error && <p role="alert" className="text-sm border-l-2 border-red bg-red-deep pl-3 py-2 text-red-text">{error}</p>}
        </div>

        {/* ── Side column (4 cols) ── */}
        <div className="lg:col-span-4 space-y-4 flex flex-col">
          <div className="border border-rule bg-coal p-4 space-y-3">
            <h3 className="label">Objectives</h3>
            <BriefText text={brief.brief} />
          </div>

          <details className="group border border-rule bg-coal">
            <summary className="flex items-center justify-between cursor-pointer select-none px-4 py-3 text-sm text-beige list-none">
              <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-beige-dim" /> Hints <span className="text-beige-faint">· {hints.length} of {brief.hints_total} used</span></span>
              <span className="text-beige-dim group-open:rotate-90 transition-transform" aria-hidden="true">›</span>
            </summary>
            <div className="px-4 pb-4 pt-3 space-y-3 border-t border-rule">
              {hints.map((h) => (
                <p key={h.index} className="text-sm border-l-2 border-red pl-3 text-beige">
                  <span className="font-semibold text-white">Hint {h.index + 1}.</span> {h.text}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: brief.hints_total }).map((_, i) => hints.some((h) => h.index === i) ? null : (
                  <button key={i} disabled={closed} onClick={() => unlockHint(i)} className={btn}>
                    Reveal hint {i + 1} <span className="text-beige-dim">−{penalties[i] ?? 0.5}</span>
                  </button>
                ))}
              </div>
            </div>
          </details>

          {/* Output console */}
          <div className="border border-rule bg-coal overflow-hidden flex flex-col min-h-[220px]">
            <div className="flex items-center justify-between px-3 py-2 bg-coal-well border-b border-rule text-[11px] text-beige-dim">
              <span className="flex items-center gap-1.5 text-beige"><Terminal className="w-3.5 h-3.5" /> Output</span>
              {outcome && <button onClick={() => setOutcome(null)} className="text-beige-faint hover:text-white">Clear</button>}
            </div>
            <div className="p-3 bg-coal-well flex-1 overflow-y-auto font-mono text-xs text-beige space-y-1.5" aria-live="polite">
              {!outcome && <p className="text-beige-faint">{hasEditor ? "› Edit the code, then press “Submit for grading”." : "› Submit your answers to get them checked."}</p>}
              {outcome?.restored && <p className="text-beige-faint">› last graded submission</p>}
              {outcome && <p className={`whitespace-pre-wrap ${outcome.success === false ? "text-red-text" : "text-white"}`}>› {outcome.message}</p>}
              {outcome?.checks?.map((c, i) => (
                <div key={i} className="flex gap-2">
                  {c.points < 0 || !c.passed ? <X className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-text" strokeWidth={3} /> : <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={3} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2"><span>{c.name}</span><span className="tabular-nums text-white">{Number(c.points).toFixed(2)}{c.max ? <span className="text-beige-faint"> / {Number(c.max).toFixed(2)}</span> : null}</span></div>
                    {c.note && <div className="text-beige-dim">{c.note}</div>}
                  </div>
                </div>
              ))}
              {outcome?.breakdown && (
                <p className="pt-2 border-t border-rule text-beige-dim">
                  best {Number(outcome.breakdown.best_raw_score).toFixed(2)}
                  {outcome.breakdown.hint_deduction > 0 && ` − hints ${outcome.breakdown.hint_deduction}`}
                  {outcome.breakdown.attempt_deduction > 0 && ` − wrong ${outcome.breakdown.attempt_deduction}`}
                  {" = "}<span className="text-white font-semibold">{Number(outcome.net).toFixed(2)}</span> / 10
                </p>
              )}
              {outcome?.passed && <p className="text-white font-semibold">› Stage complete — moving on…</p>}
            </div>
          </div>

          {!closed && Number(brief.best_raw) > 0 && (
            <button onClick={finalize} disabled={finalizing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-beige-dim text-sm text-beige hover:bg-beige hover:text-ink disabled:opacity-40">
              <Lock className="w-4 h-4" /> Lock in {Number(brief.score || 0).toFixed(2)} and continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
