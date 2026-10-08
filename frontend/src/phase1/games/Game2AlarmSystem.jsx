import React, { useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { 
  Play, ShieldAlert, CheckCircle, AlertCircle, RefreshCw, 
  Terminal, Code2, Cpu, Bug, ChevronRight
} from "lucide-react";
import { game2Api } from "../api";

export default function Game2AlarmSystem({ onStageComplete, dashboard, onRefresh }) {
  const [challenges, setChallenges] = useState([]);
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [code, setCode] = useState("");
  const [terminalOutput, setTerminalOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resultFeedback, setResultFeedback] = useState(null);

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    try {
      const res = await game2Api.getChallenges();
      const list = res.challenges || [];
      setChallenges(list);
      if (list.length > 0) {
        setActiveChallenge(list[0]);
        setCode(list[0].buggyCode);
      }
    } catch (err) {
      console.error("Failed to load Game 2 challenges:", err);
    }
  };

  const handleSelectChallenge = (ch) => {
    setActiveChallenge(ch);
    setCode(ch.buggyCode);
    setTerminalOutput("");
    setResultFeedback(null);
  };

  const handleRunCode = async () => {
    setRunning(true);
    setTerminalOutput(">>> [SECURITY KERNEL] Initializing Python execution sandboxed environment...\n");
    try {
      const res = await game2Api.runCode(code);
      let out = "";
      if (res.stdout) out += res.stdout;
      if (res.stderr) out += (out ? "\n" : "") + `[STDERR Traceback]:\n${res.stderr}`;
      if (!out) out = "[Process completed with Exit Code 0 (No stdout produced)]";
      setTerminalOutput(out);
    } catch (err) {
      setTerminalOutput(`Execution error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!activeChallenge) return;
    setSubmitting(true);
    setResultFeedback(null);

    const idempotencyKey = `g2-${Date.now()}-${activeChallenge.id}`;
    try {
      const res = await game2Api.submit({
        idempotency_key: idempotencyKey,
        challenge_id: activeChallenge.id,
        code: code,
        time_spent_seconds: 120
      });
      setResultFeedback(res);
      if (res.feedback?.stdout) {
        setTerminalOutput(res.feedback.stdout);
      }
      if (res.passed) {
        await onRefresh();
        setTimeout(() => {
          onStageComplete(3);
        }, 1800);
      }
    } catch (err) {
      setResultFeedback({ passed: false, message: err.message || "Evaluation failed." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Stage Header */}
      <div className="p-5 rounded-2xl glass-panel-glow border border-[#d4af37]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#00e5ff] font-bold uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-[#00e5ff]/20 border border-[#00e5ff]/40">STAGE 02</span>
            <span>PYTHON CYBERSECURITY DEBUGGING</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight mt-1">
            Alarm System: Subroutine Neutralization
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1 max-w-2xl">
            Neutralize the vault perimeter alarm system. Inspect the subroutine code below, diagnose and fix the <span className="text-[#d4af37]">3 bugs</span>, and execute the disarm sequence to silence the alarm.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#111726] border border-[#23304d] text-center font-mono">
            <div className="text-[10px] text-gray-400 uppercase">Max Score</div>
            <div className="text-sm font-extrabold text-[#d4af37]">10.00 pts</div>
          </div>
        </div>
      </div>

      {/* Subroutine Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {challenges.map((ch, idx) => {
          const isSelected = activeChallenge?.id === ch.id;
          return (
            <button
              key={ch.id}
              onClick={() => handleSelectChallenge(ch)}
              className={`px-3 py-2 rounded-xl font-mono text-xs font-medium border whitespace-nowrap transition flex items-center gap-2 ${
                isSelected 
                  ? "bg-[#00e5ff]/20 border-[#00e5ff] text-white shadow-lg shadow-[#00e5ff]/10" 
                  : "bg-[#111726] border-[#23304d] text-gray-400 hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>#{idx + 1}: {ch.title}</span>
            </button>
          );
        })}
      </div>

      {/* Main IDE Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Editor Area (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel rounded-2xl border border-[#23304d] overflow-hidden flex flex-col h-[520px]">
            
            {/* Editor Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1422] border-b border-[#23304d]">
              <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
                <Code2 className="w-4 h-4 text-[#d4af37]" />
                <span className="font-bold">{activeChallenge?.id || "subroutine"}.py</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161f33] text-gray-400 border border-[#23304d]">
                  {activeChallenge?.category || "Python"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCode(activeChallenge?.buggyCode || "")}
                  className="px-2.5 py-1 rounded bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-[11px] font-mono text-gray-300 flex items-center gap-1 transition"
                  title="Reset Code"
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={handleRunCode}
                  className="px-3.5 py-1 rounded bg-[#161f33] hover:bg-[#202c45] border border-emerald-500/40 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5 transition"
                >
                  <Play className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
                  {running ? "Executing..." : "Run Test"}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitSolution}
                  className="px-4 py-1 rounded bg-gradient-to-r from-[#d4af37] to-[#b89628] hover:from-[#e5bd3d] hover:to-[#c5a02e] text-black text-xs font-mono font-bold flex items-center gap-1.5 shadow transition"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {submitting ? "Evaluating..." : "Neutralize"}
                </button>
              </div>
            </div>

            {/* Monaco Code Editor */}
            <div className="flex-1 bg-[#090d14]">
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                options={{
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  lineNumbers: "on",
                }}
              />
            </div>

          </div>
        </div>

        {/* Right Console & Verification Details (4 Cols) */}
        <div className="lg:col-span-4 space-y-4 flex flex-col h-[520px]">
          
          {/* Challenge Description */}
          <div className="glass-panel p-4 rounded-xl border border-[#23304d] text-xs font-mono space-y-2">
            <h4 className="font-bold text-gray-200 uppercase flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5 text-rose-400" />
              Subroutine Audit Objectives
            </h4>
            <p className="text-gray-400 leading-relaxed">
              {activeChallenge?.description || "Locate all 3 defects and execute code to output signature."}
            </p>
          </div>

          {/* Terminal Output */}
          <div className="glass-panel rounded-xl border border-[#23304d] overflow-hidden flex-1 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 bg-[#0d121d] border-b border-[#23304d] text-[11px] font-mono text-gray-400">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Terminal className="w-3.5 h-3.5 text-[#d4af37]" /> Output Console
              </span>
              <button
                onClick={() => setTerminalOutput("")}
                className="text-[10px] text-gray-500 hover:text-white"
              >
                Clear
              </button>
            </div>
            <div className="p-3 bg-[#080c14] flex-1 overflow-y-auto font-mono text-xs text-gray-300 whitespace-pre-wrap selection:bg-[#00e5ff]/30">
              {terminalOutput || ">>> Ready. Press [Run Test] to execute your modified subroutine script."}
            </div>
          </div>

          {/* Result Feedback Banner */}
          {resultFeedback && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono animate-fadeIn ${
              resultFeedback.passed 
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300" 
                : "bg-rose-950/60 border-rose-500/50 text-rose-300"
            }`}>
              <div className="font-bold flex items-center gap-1.5 mb-1">
                {resultFeedback.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
                {resultFeedback.passed ? "ALARM DISARMED!" : "DISARM FAILED"}
              </div>
              <p>{resultFeedback.message}</p>
              {resultFeedback.passed && (
                <p className="mt-1 font-bold text-emerald-400">
                  Score Awarded: +{resultFeedback.score_awarded} pts &bull; Advancing to Stage 03...
                </p>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
