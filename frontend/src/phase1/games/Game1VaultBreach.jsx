import React, { useState, useEffect } from "react";
import { 
  Key, Shield, FileText, Search, Lock, Unlock, HelpCircle, 
  CheckCircle, AlertTriangle, ArrowRight, Binary
} from "lucide-react";
import { game1Api, progressApi } from "../api";

export default function Game1VaultBreach({ onStageComplete, dashboard, onRefresh }) {
  const [evidence, setEvidence] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  
  // Cipher Helper
  const [cipherInput, setCipherInput] = useState("");
  const [cipherShift, setCipherShift] = useState(3);
  const [cipherOutput, setCipherOutput] = useState("");

  useEffect(() => {
    loadChallenge();
  }, []);

  const loadChallenge = async () => {
    try {
      const data = await game1Api.getChallenge();
      setEvidence(data.evidence || []);
      if (data.evidence?.length > 0) {
        setSelectedDoc(data.evidence[0]);
      }
    } catch (err) {
      console.error("Failed to load Game 1 challenge:", err);
    }
  };

  const handleCipherCompute = () => {
    if (!cipherInput) {
      setCipherOutput("");
      return;
    }
    const shifted = cipherInput
      .split("")
      .map((ch) => {
        if (ch >= "0" && ch <= "9") {
          const num = parseInt(ch, 10);
          return (num + cipherShift) % 10;
        }
        return ch;
      })
      .join("");
    setCipherOutput(shifted);
  };

  const handleKeypadPress = (val) => {
    if (pin.length < 6) {
      setPin((prev) => prev + val);
    }
  };

  const handleKeypadClear = () => {
    setPin("");
    setFeedback(null);
  };

  const handleKeypadSubmit = async () => {
    if (pin.length !== 6) {
      setFeedback({ passed: false, message: "PIN combination must be exactly 6 digits." });
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    const idempotencyKey = `g1-${Date.now()}-${pin}`;
    try {
      const res = await game1Api.submit({
        idempotency_key: idempotencyKey,
        final_code: pin
      });
      setFeedback(res);
      if (res.passed) {
        await onRefresh();
        setTimeout(() => {
          onStageComplete(2);
        }, 1800);
      }
    } catch (err) {
      setFeedback({ passed: false, message: err.message || "Submission failed." });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEvidence = evidence.filter((e) => 
    e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.body.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-rise">
      
      {/* Game Title & Professor Briefing Banner */}
      <div className="p-5 rounded-2xl glass-panel-glow border border-[#D2362B]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans text-[#E9DFCB] font-bold uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-[#D2362B]/20 border border-[#D2362B]/40">STAGE 01</span>
            <span>LOGIC & CRYPTOGRAPHY</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-semibold text-white tracking-tight mt-1">
            EL CODIGO ROJO: Vault Breach
          </h2>
          <p className="text-xs text-gray-400 font-sans mt-1 max-w-2xl">
            Neutralize the Royal Mint outer vault tumbler lock. Deduce the <span className="text-[#E9DFCB]">Door</span>, the <span className="text-[#E9DFCB]">Witness</span>, and the <span className="text-[#E9DFCB]">Metal Lot</span> from intercepted intelligence, apply the Professor's key shift, and crack the 6-digit PIN.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-[#161210] border border-[#352D27] text-center font-sans">
            <div className="text-[10px] text-gray-400 uppercase">Target Score</div>
            <div className="text-sm font-extrabold text-[#E9DFCB]">10.00 pts</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Evidence Board + Right Cipher & Keypad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Evidence Dossier (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="glass-panel p-4 rounded-xl border border-[#352D27] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-sans font-bold text-gray-300 uppercase">
                <FileText className="w-4 h-4 text-[#E9DFCB]" />
                <span>Intercepted Intelligence Dossier</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter dossier text..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-2.5 py-1 text-xs font-sans rounded-lg bg-[#0A0807] border border-[#352D27] text-white focus:outline-none focus:border-[#D2362B]"
                />
              </div>
            </div>

            {/* Evidence Selector Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filteredEvidence.map((doc) => {
                const isSelected = selectedDoc?.id === doc.id;
                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium whitespace-nowrap border transition ${
                      isSelected 
                        ? "bg-[#D2362B]/20 border-[#D2362B] text-white" 
                        : "bg-[#161210] border-[#352D27] text-gray-400 hover:text-white"
                    }`}
                  >
                    #{doc.id}: {doc.title}
                  </button>
                );
              })}
            </div>

            {/* Document Viewer */}
            {selectedDoc ? (
              <div className="p-4 rounded-xl bg-[#0A0807] border border-[#352D27] font-sans text-xs text-gray-300 space-y-3">
                <div className="flex items-center justify-between border-b border-[#352D27] pb-2 text-[11px] text-gray-500">
                  <span>CLASSIFICATION: {selectedDoc.metadata?.classification || "RESTRICTED"}</span>
                  <span>SOURCE: {selectedDoc.metadata?.source || "ARCHIVE"}</span>
                </div>
                <div className="font-mono text-[13px] whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-2 selection:bg-[#D2362B]/40 selection:text-white">
                  {selectedDoc.body}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 font-sans text-xs">
                No document selected.
              </div>
            )}
          </div>

          {/* Deductions Helper Box */}
          <div className="glass-panel p-4 rounded-xl border border-[#352D27] space-y-2">
            <h4 className="text-xs font-sans font-bold text-gray-300 uppercase flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-[#E9DFCB]" />
              Professor's Tactical Clues
            </h4>
            <ul className="text-xs font-sans text-gray-400 space-y-1 list-disc list-inside">
              <li><strong className="text-gray-200">Shift count</strong>: The number of keys physically carried by voices on the intercepted channel.</li>
              <li><strong className="text-gray-200">Door Panel</strong>: The audit shift swap assigned to Quill (Tomas Herrera, Badge 4471).</li>
              <li><strong className="text-gray-200">Witness Tag</strong>: Camera evidence tag showing Quill at his panel on 08 OCT.</li>
              <li><strong className="text-gray-200">Metal Lot</strong>: Second pour of Anniversary bullion with the scarlet seal.</li>
            </ul>
          </div>

        </div>

        {/* Right Column: Interactive Caesar Shift & Vault Keypad (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Caesar Shift Calculator */}
          <div className="glass-panel p-4 rounded-xl border border-[#352D27] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-sans font-bold text-gray-300 uppercase flex items-center gap-1.5">
                <Binary className="w-4 h-4 text-[#E9DFCB]" />
                Caesar Digit Shift Terminal
              </span>
              <span className="text-[11px] font-sans text-gray-500">Wrap Mod 10</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] text-gray-400 font-sans block mb-1">Value (2 digits)</label>
                <input
                  type="text"
                  placeholder="e.g. 38"
                  maxLength={4}
                  value={cipherInput}
                  onChange={(e) => setCipherInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0A0807] border border-[#352D27] text-white text-xs font-sans focus:outline-none focus:border-[#D2362B]"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-sans block mb-1">Shift (+N)</label>
                <input
                  type="number"
                  value={cipherShift}
                  onChange={(e) => setCipherShift(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0A0807] border border-[#352D27] text-white text-xs font-sans focus:outline-none focus:border-[#D2362B]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleCipherCompute}
                className="px-3 py-1.5 rounded-lg bg-[#161210] hover:bg-[#1F1A17] border border-[#352D27] text-xs font-sans text-[#E9DFCB] font-bold"
              >
                Apply Shift &rarr;
              </button>
              {cipherOutput && (
                <div className="text-xs font-sans text-emerald-400 font-bold bg-emerald-950/40 px-3 py-1 rounded border border-emerald-500/30">
                  Shifted: {cipherOutput}
                </div>
              )}
            </div>
          </div>

          {/* Interactive Mechanical Vault Keypad */}
          <div className="glass-panel-glow p-6 rounded-2xl border border-[#352D27] text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Lock className="w-5 h-5 text-[#E9DFCB]" />
              <h3 className="text-sm font-bold text-white font-sans uppercase tracking-wider">
                Vault Master Combination
              </h3>
            </div>

            {/* PIN Display Screen */}
            <div className="py-3 px-4 rounded-xl bg-[#0A0807] border-2 border-[#352D27] tracking-[0.5em] font-sans text-2xl font-bold text-[#E9DFCB] flex items-center justify-center min-h-[56px] shadow-inner">
              {pin.padEnd(6, "•")}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num.toString())}
                  className="h-12 rounded-xl bg-[#161210] hover:bg-[#1F1A17] active:scale-95 border border-[#352D27] text-white font-sans font-bold text-lg transition"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleKeypadClear}
                className="h-12 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 active:scale-95 border border-rose-900/40 text-rose-400 font-sans text-xs font-bold transition"
              >
                CLR
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress("0")}
                className="h-12 rounded-xl bg-[#161210] hover:bg-[#1F1A17] active:scale-95 border border-[#352D27] text-white font-sans font-bold text-lg transition"
              >
                0
              </button>
              <button
                type="button"
                disabled={submitting || pin.length !== 6}
                onClick={handleKeypadSubmit}
                className={`h-12 rounded-xl border text-xs font-sans font-bold transition flex items-center justify-center ${
                  pin.length === 6
                    ? "bg-[#D2362B] hover:bg-[#B22B21] text-white border-[#D2362B]"
                    : "bg-[#161210] border-[#352D27] text-gray-500 cursor-not-allowed"
                }`}
              >
                {submitting ? "..." : "OPEN"}
              </button>
            </div>

            {/* Feedback Message */}
            {feedback && (
              <div className={`p-3 rounded-xl text-xs font-sans border animate-rise ${
                feedback.passed 
                  ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300" 
                  : "bg-rose-950/60 border-rose-500/50 text-rose-300"
              }`}>
                <div className="font-bold flex items-center justify-center gap-1.5 mb-1">
                  {feedback.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                  {feedback.passed ? "VAULT UNLOCKED!" : "ACCESS DENIED"}
                </div>
                <p>{feedback.message}</p>
                {feedback.passed && (
                  <p className="mt-1 text-emerald-400 font-bold">
                    Score Awarded: +{feedback.score_awarded} pts &bull; Transitioning to Stage 02...
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
