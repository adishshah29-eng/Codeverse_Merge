import React, { useState } from "react";
import { 
  Eye, Search, Code, Network, Database, Key, CheckCircle, 
  AlertTriangle, FileCode, Radio, ExternalLink, ShieldCheck
} from "lucide-react";
import { game3Api } from "../api";

export default function Game3HiddenBlueprint({ onStageComplete, dashboard, onRefresh }) {
  const [activeTab, setActiveTab] = useState("elements");
  const [cssOverridden, setCssOverridden] = useState(false);
  const [pingData, setPingData] = useState(null);
  const [manifestData, setManifestData] = useState(null);
  const [pressData, setPressData] = useState(null);
  const [storageData, setStorageData] = useState({
    theme: "archive",
    last_visit: "1963",
    debug_mode: "false",
    mint_fragment: "17-04",
  });
  const [fragmentInput, setFragmentInput] = useState("");
  const [blueprintCode, setBlueprintCode] = useState("");
  const [submissionCode, setSubmissionCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handlePing = async () => {
    try {
      const data = await game3Api.ping();
      setPingData(data);
    } catch (err) {
      setPingData({ error: err.message });
    }
  };

  const handleFetchManifest = async () => {
    try {
      const data = await game3Api.manifest();
      setManifestData(data);
    } catch (err) {
      setManifestData({ error: err.message });
    }
  };

  const handleFetchPress = async () => {
    try {
      const data = await game3Api.press();
      setPressData(data);
    } catch (err) {
      setPressData({ error: err.message });
    }
  };

  const handleUnlockBlueprint = async () => {
    if (!fragmentInput) return;
    try {
      const res = await game3Api.queryBlueprint(fragmentInput);
      if (res.success && res.code) {
        setBlueprintCode(res.code);
        setSubmissionCode(res.code);
      } else {
        alert(res.message || "Invalid fragment.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleSubmitFinalCode = async () => {
    if (!submissionCode) return;
    setSubmitting(true);
    setFeedback(null);

    const idempotencyKey = `g3-${Date.now()}-${submissionCode}`;
    try {
      const res = await game3Api.submit({
        idempotency_key: idempotencyKey,
        extraction_code: submissionCode,
        blueprint_fragment: fragmentInput || "17-04"
      });
      setFeedback(res);
      if (res.passed) {
        await onRefresh();
        setTimeout(() => {
          onStageComplete(4);
        }, 1800);
      }
    } catch (err) {
      setFeedback({ passed: false, message: err.message || "Submission failed." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Stage Header */}
      <div className="p-5 rounded-2xl glass-panel-glow border border-[#d4af37]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-purple-950/40 border border-purple-500/40">STAGE 03</span>
            <span>WEB FORENSICS & REVERSE ENGINEERING</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight mt-1">
            Hidden Blueprint: The Professor's Override
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1 max-w-2xl">
            Infiltrate the sealed 1963 Royal Mint archives. Use built-in DevTools forensic inspection (DOM, Styles, Network Relay, Application Storage) to uncover the hidden fragment and unseal the blueprint extraction code.
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-[#111726] border border-[#23304d] text-center font-mono">
          <div className="text-[10px] text-gray-400 uppercase">Max Score</div>
          <div className="text-sm font-extrabold text-[#d4af37]">10.00 pts</div>
        </div>
      </div>

      {/* Main Forensic Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Simulated Archive Terminal & DevTools (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="glass-panel rounded-2xl border border-[#23304d] overflow-hidden flex flex-col">
            
            {/* DevTools Tab Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f1422] border-b border-[#23304d]">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
                <button
                  onClick={() => setActiveTab("elements")}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === "elements" ? "bg-[#1c273e] text-[#d4af37] font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> Elements & DOM
                </button>
                <button
                  onClick={() => setActiveTab("styles")}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === "styles" ? "bg-[#1c273e] text-[#d4af37] font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" /> Styles (CSS)
                </button>
                <button
                  onClick={() => setActiveTab("network")}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === "network" ? "bg-[#1c273e] text-[#d4af37] font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Network className="w-3.5 h-3.5" /> Network (API)
                </button>
                <button
                  onClick={() => setActiveTab("storage")}
                  className={`px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
                    activeTab === "storage" ? "bg-[#1c273e] text-[#d4af37] font-bold" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Database className="w-3.5 h-3.5" /> LocalStorage
                </button>
              </div>

              <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                DevTools Inspector v3.7
              </span>
            </div>

            {/* Inspector Canvas */}
            <div className="p-5 bg-[#090d14] min-h-[360px] font-mono text-xs space-y-4">
              
              {activeTab === "elements" && (
                <div className="space-y-3 text-gray-300">
                  <div className="p-3 rounded-lg bg-[#0d121d] border border-[#23304d] text-emerald-400">
                    &lt;!-- ARCHIVE NOTE 17: The visible page is incomplete. Search for "ledger". --&gt;
                  </div>
                  <div className="space-y-1.5 pl-3 border-l-2 border-[#23304d]">
                    <div className="text-gray-400">&lt;main class="mint-archives"&gt;</div>
                    <div className="pl-4 text-gray-300">
                      &lt;div class="archive-header"&gt;...&lt;/div&gt;
                    </div>
                    <div className="pl-4 text-[#d4af37] bg-[#d4af37]/10 p-2 rounded border border-[#d4af37]/30">
                      &lt;div id="archive-ledger" hidden data-next="/archive/ledger"&gt;&lt;/div&gt;
                    </div>
                    <div className="pl-4 text-purple-300">
                      &lt;button class="archive-access" style="{cssOverridden ? 'display: block' : 'display: none'}"&gt;
                        {cssOverridden ? "RELAY PIN CONNECTED" : "[HIDDEN IN CSS]"}
                      &lt;/button&gt;
                    </div>
                    <div className="text-gray-400">&lt;/main&gt;</div>
                  </div>
                  <p className="text-[11px] text-gray-500 italic mt-3">
                    Notice: An element with class ".archive-access" is embedded but currently suppressed via CSS styles.
                  </p>
                </div>
              )}

              {activeTab === "styles" && (
                <div className="space-y-4 text-gray-300">
                  <div className="p-4 rounded-xl bg-[#0d121d] border border-[#23304d] space-y-2">
                    <span className="text-gray-500 text-[11px]">/* main.css: Archivist override note */</span>
                    <pre className="text-purple-300 font-mono">
{`.archive-access {
  display: ${cssOverridden ? "block /* OVERRIDDEN BY OPERATIVE */" : "none;"}
  background: #d4af37;
  color: black;
}`}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#111726] border border-[#23304d]">
                    <span className="text-xs text-gray-300">Override CSS display property to unhide access relay:</span>
                    <button
                      onClick={() => setCssOverridden(!cssOverridden)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                        cssOverridden 
                          ? "bg-emerald-600 text-white" 
                          : "bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-[#d4af37]"
                      }`}
                    >
                      {cssOverridden ? "CSS Injected: display: block" : "Override: Unhide Button"}
                    </button>
                  </div>

                  {cssOverridden && (
                    <div className="p-4 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/40 flex items-center justify-between">
                      <span className="text-white font-bold">Relay Access Control Terminal Activated</span>
                      <button
                        onClick={handlePing}
                        className="px-4 py-2 rounded-lg bg-[#d4af37] text-black font-bold shadow-lg shadow-[#d4af37]/20 hover:scale-105 transition"
                      >
                        Click Archive Relay &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "network" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePing}
                      className="px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs text-[#00e5ff]"
                    >
                      POST /api/archive/ping
                    </button>
                    <button
                      onClick={handleFetchManifest}
                      className="px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs text-emerald-400"
                    >
                      GET /api/archive/manifest
                    </button>
                    <button
                      onClick={handleFetchPress}
                      className="px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs text-amber-400"
                    >
                      GET /api/archive/press
                    </button>
                  </div>

                  {pingData && (
                    <div className="p-3 rounded-xl bg-[#0d121d] border border-[#23304d]">
                      <div className="text-[11px] text-[#00e5ff] font-bold mb-1">Ping Response:</div>
                      <pre className="text-gray-300 overflow-x-auto">{JSON.stringify(pingData, null, 2)}</pre>
                    </div>
                  )}

                  {manifestData && (
                    <div className="p-3 rounded-xl bg-[#0d121d] border border-[#23304d]">
                      <div className="text-[11px] text-emerald-400 font-bold mb-1">Manifest Response:</div>
                      <pre className="text-gray-300 overflow-x-auto">{JSON.stringify(manifestData, null, 2)}</pre>
                    </div>
                  )}

                  {pressData && (
                    <div className="p-3 rounded-xl bg-[#0d121d] border border-[#23304d]">
                      <div className="text-[11px] text-amber-400 font-bold mb-1">Press Room Response:</div>
                      <pre className="text-gray-300 overflow-x-auto">{JSON.stringify(pressData, null, 2)}</pre>
                      <div className="text-emerald-400 text-[11px] mt-2 font-bold">
                        Notice "next": "storage" &rarr; Inspect Application Storage tab!
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "storage" && (
                <div className="space-y-3">
                  <div className="text-gray-400 text-xs mb-2">Browser LocalStorage Key-Value Storage:</div>
                  <div className="bg-[#0d121d] rounded-xl border border-[#23304d] overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#161f33] text-gray-400 border-b border-[#23304d]">
                        <tr>
                          <th className="py-2 px-3">Storage Key</th>
                          <th className="py-2 px-3">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#23304d]">
                        {Object.entries(storageData).map(([k, v]) => (
                          <tr key={k} className={k === "mint_fragment" ? "bg-[#d4af37]/15 font-bold text-white" : ""}>
                            <td className="py-2 px-3 text-[#d4af37]">{k}</td>
                            <td className="py-2 px-3 text-gray-300 font-bold">{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs">
                    Discovered Architectural Fragment: <strong className="text-white">"17-04"</strong>. Input this fragment into the blueprint console.
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>

        {/* Right Column: Blueprint Retrieval & Final Code Submission (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Blueprint Query Card */}
          <div className="glass-panel p-5 rounded-2xl border border-[#23304d] space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-[#d4af37]" />
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Blueprint Vault Query
              </h3>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-mono block mb-1">
                Recovered Fragment Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 17-04"
                  value={fragmentInput}
                  onChange={(e) => setFragmentInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[#0d121d] border border-[#23304d] text-white text-xs font-mono focus:outline-none focus:border-[#d4af37]"
                />
                <button
                  type="button"
                  onClick={handleUnlockBlueprint}
                  className="px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs font-mono text-[#d4af37] font-bold"
                >
                  Retrieve
                </button>
              </div>
            </div>

            {blueprintCode && (
              <div className="p-3.5 rounded-xl bg-[#090d14] border-2 border-emerald-500/50 text-center font-mono space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase">
                  CLASSIFIED BLUEPRINT RECOVERED
                </span>
                <div className="text-2xl font-black text-white tracking-widest text-[#d4af37]">
                  {blueprintCode}
                </div>
                <span className="text-[10px] text-gray-500 block">Royal Mint 1963 Extraction Key</span>
              </div>
            )}
          </div>

          {/* Extraction Code Clearance Submission */}
          <div className="glass-panel-glow p-5 rounded-2xl border border-[#23304d] space-y-4">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00e5ff]" />
              Extraction Code Clearance
            </h3>

            <div>
              <label className="text-[10px] text-gray-400 font-mono block mb-1">
                Final Extraction Code
              </label>
              <input
                type="text"
                placeholder="RM-XXXXXX"
                value={submissionCode}
                onChange={(e) => setSubmissionCode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d14] border border-[#23304d] text-white text-sm font-mono font-bold tracking-widest uppercase focus:outline-none focus:border-[#d4af37]"
              />
            </div>

            <button
              onClick={handleSubmitFinalCode}
              disabled={submitting || !submissionCode}
              className={`w-full py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                submissionCode
                  ? "bg-gradient-to-r from-[#d4af37] to-[#b89628] hover:from-[#e5bd3d] hover:to-[#c5a02e] text-black shadow-lg shadow-[#d4af37]/20"
                  : "bg-[#161f33] text-gray-500 border border-[#23304d] cursor-not-allowed"
              }`}
            >
              {submitting ? "Verifying Archive..." : "Authenticate Extraction"}
            </button>

            {feedback && (
              <div className={`p-3 rounded-xl border text-xs font-mono animate-fadeIn ${
                feedback.passed 
                  ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300" 
                  : "bg-rose-950/60 border-rose-500/50 text-rose-300"
              }`}>
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  {feedback.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                  {feedback.passed ? "BLUEPRINT AUTHENTICATED!" : "ACCESS DENIED"}
                </div>
                <p>{feedback.message}</p>
                {feedback.passed && (
                  <p className="mt-1 font-bold text-emerald-400">
                    Score Awarded: +{feedback.score_awarded} pts &bull; Unlocking Stage 04...
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
