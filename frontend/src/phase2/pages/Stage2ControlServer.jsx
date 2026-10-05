import React, { useState, useEffect } from "react";
import { API_BASE } from "../../shared/config";
import { api } from "../api";

export default function Stage2ControlServer({ team, onStageCompleted }) {
  const [ctfState, setCtfState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inputCodes, setInputCodes] = useState({ 1: "", 2: "", 3: "" });
  const [submittingSector, setSubmittingSector] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [controlToken, setControlToken] = useState(null);

  // Bank puzzle quick test state
  const [tellerUser, setTellerUser] = useState("");
  const [tellerPass, setTellerPass] = useState("");
  const [tellerDebug, setTellerDebug] = useState(null);

  const [transferAmount, setTransferAmount] = useState("1000");
  const [transferDebug, setTransferDebug] = useState(null);

  const [balanceDebug, setBalanceDebug] = useState(null);

  const loadState = async () => {
    try {
      const res = await api.getCtfState();
      setCtfState(res.state);
      if (res.state?.isCompleted) {
        setControlToken("CAPTURED");
      } else {
        setControlToken(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, []);

  const handleCodeSubmit = async (puzzleId) => {
    const code = inputCodes[puzzleId];
    if (!code || !code.trim()) return;

    setSubmittingSector(puzzleId);
    setFeedback((prev) => ({ ...prev, [puzzleId]: null }));
    try {
      const res = await api.submitCtfCode(puzzleId, code.trim());
      setFeedback((prev) => ({ ...prev, [puzzleId]: res }));
      await loadState();

      if (res.allSolved) {
        setControlToken("CAPTURED");
        if (onStageCompleted) onStageCompleted(2, 10.0);
      }
    } catch (err) {
      setFeedback((prev) => ({ ...prev, [puzzleId]: { success: false, message: err.message } }));
    } finally {
      setSubmittingSector(null);
    }
  };

  // Interactive quick testers
  const testTellerLogin = async () => {
    try {
      const res = await api.tellerLogin(tellerUser, tellerPass);
      setTellerDebug(res);
      if (res.success) await loadState();
      if (res.allSolved && onStageCompleted) onStageCompleted(2, 10.0);
    } catch (err) {
      setTellerDebug({ success: false, message: err.message });
    }
  };

  const testTransfer = async () => {
    try {
      const res = await api.transferFunds("1001", "IVB-OFFSHORE-1", transferAmount);
      setTransferDebug(res);
      if (res.success) await loadState();
      if (res.allSolved && onStageCompleted) onStageCompleted(2, 10.0);
    } catch (err) {
      setTransferDebug({ success: false, message: err.message });
    }
  };

  const testBalanceHeader = async () => {
    try {
      const res = await fetch(`${API_BASE}/ctf/balance?acct=1001`, { credentials: "same-origin" });
      const data = await res.json();
      const auditCode = res.headers.get("x-audit-code");
      const requestId = res.headers.get("x-request-id");
      setBalanceDebug({
        body: data,
        auditHeader: auditCode || "[CACHE MISS: Header appears on subsequent requests in hard mode]",
        requestId: requestId || "[None]",
      });
      if (auditCode) {
        setInputCodes((prev) => ({ ...prev, 3: auditCode }));
      }
    } catch (err) {
      setBalanceDebug({ error: err.message });
    }
  };

  const puzzles = ctfState?.puzzles || {};

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="badge badge-crimson font-mono">SECTOR 02 // WEB & API FORENSICS</span>
          <span className="badge badge-gold font-mono">MAX 10.0 PTS</span>
        </div>
        <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 6 }}>
          FIND THE CONTROL SERVER
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 900 }}>
          Infiltrate the IronVault banking infrastructure. Three security layers protect the master command server.
          Exploit the vulnerable Teller Login query, bypass the frozen DOM transfer overlay, and extract the hidden
          audit header from internal telemetry. Breach all three sectors to capture the <strong>Control Token</strong>.
        </p>
      </div>

      {/* Control Token Success Banner */}
      {controlToken && (
        <div className="glass-panel" style={{
          padding: 24,
          marginBottom: 28,
          border: "1px solid var(--emerald)",
          background: "rgba(16, 185, 129, 0.08)",
          boxShadow: "0 0 30px rgba(16, 185, 129, 0.2)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div className="badge badge-emerald font-mono" style={{ marginBottom: 6 }}>
                ✓ ALL SECTORS COMPROMISED // CONTROL SERVER CAPTURED
              </div>
              <h2 style={{ fontSize: "1.4rem", fontFamily: "var(--font-display)", color: "#fff" }}>
                CONTROL SERVER STATUS: <span style={{ color: "var(--emerald)" }}>{controlToken}</span>
              </h2>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>
                Control token registered in team game outputs. Armed for Stage 4 Final Extraction.
              </p>
            </div>
            <div style={{ fontSize: "2.4rem" }}>
              🏆
            </div>
          </div>
        </div>
      )}

      {/* 3 Sectors Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* Sector 1: Teller Login */}
        <div className="glass-panel" style={{
          padding: 24,
          border: `1px solid ${puzzles["1"]?.solved ? "rgba(16, 185, 129, 0.4)" : "var(--border-subtle)"}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="badge badge-crimson font-mono">SECTOR 01 // SQLi</span>
            <span className={`badge ${puzzles["1"]?.solved ? "badge-emerald" : "badge-gold"}`}>
              {puzzles["1"]?.solved ? "BREACHED" : "LOCKED"}
            </span>
          </div>

          <h3 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 700, marginBottom: 6 }}>
            The Teller Login
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            An archaic teller authentication terminal. When queries fail, debug errors expose the SQL structure.
            The filter strips <code>--</code> and <code>;</code>. Bypass the query with a tautology.
          </p>

          {/* Quick interactive tester */}
          <div style={{ background: "rgba(0,0,0,0.4)", padding: 14, borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--cyan)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
              ⚡ QUICK INJECTION TESTER
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                value={tellerUser}
                onChange={(e) => setTellerUser(e.target.value)}
                placeholder="Username payload"
                className="input-cyber"
                style={{ fontSize: "0.8rem", padding: "6px 10px" }}
              />
              <button onClick={testTellerLogin} className="btn btn-ghost" style={{ fontSize: "0.7rem", padding: "6px" }}>
                EXECUTE LOGIN QUERY →
              </button>
            </div>

            {tellerDebug && (
              <div style={{ marginTop: 10, fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: tellerDebug.success ? "#34d399" : "#f87171" }}>
                <div>Query: {tellerDebug.query}</div>
                <div>{tellerDebug.message}</div>
              </div>
            )}
          </div>

          {/* Code Authorization */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
              SUBMIT SECTOR 01 CODE:
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={inputCodes[1]}
                onChange={(e) => setInputCodes({ ...inputCodes, 1: e.target.value.toUpperCase() })}
                placeholder="IVB-LEVEL1-..."
                className="input-cyber font-mono"
                style={{ fontSize: "0.85rem" }}
              />
              <button
                onClick={() => handleCodeSubmit(1)}
                disabled={submittingSector === 1 || puzzles["1"]?.solved}
                className="btn btn-gold"
                style={{ fontSize: "0.75rem", padding: "8px 16px" }}
              >
                SUBMIT
              </button>
            </div>
            {feedback[1] && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: feedback[1].success ? "#34d399" : "#f87171" }}>
                {feedback[1].message}
              </div>
            )}
          </div>
        </div>

        {/* Sector 2: Transfers DOM */}
        <div className="glass-panel" style={{
          padding: 24,
          border: `1px solid ${puzzles["2"]?.solved ? "rgba(16, 185, 129, 0.4)" : "var(--border-subtle)"}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="badge badge-crimson font-mono">SECTOR 02 // DOM BYPASS</span>
            <span className={`badge ${puzzles["2"]?.solved ? "badge-emerald" : "badge-gold"}`}>
              {puzzles["2"]?.solved ? "BREACHED" : "LOCKED"}
            </span>
          </div>

          <h3 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 700, marginBottom: 6 }}>
            The Frozen Transfer Button
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            The transfer button is disabled and a transparent <code>div.fraud-shield</code> overlay intercepts clicks.
            Trigger the authoritative transfer transaction to expose the level 2 clearance code.
          </p>

          {/* Quick interactive tester */}
          <div style={{ background: "rgba(0,0,0,0.4)", padding: 14, borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--cyan)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
              ⚡ TRANSFER CONTROLLER
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                type="text"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Amount"
                className="input-cyber"
                style={{ fontSize: "0.8rem", padding: "6px 10px" }}
              />
              <button onClick={testTransfer} className="btn btn-ghost" style={{ fontSize: "0.7rem", padding: "6px" }}>
                FORCE WIRE TRANSFER →
              </button>
            </div>

            {transferDebug && (
              <div style={{ marginTop: 10, fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "#34d399" }}>
                <div>{transferDebug.message}</div>
              </div>
            )}
          </div>

          {/* Code Authorization */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
              SUBMIT SECTOR 02 CODE:
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={inputCodes[2]}
                onChange={(e) => setInputCodes({ ...inputCodes, 2: e.target.value.toUpperCase() })}
                placeholder="IVB-LEVEL2-..."
                className="input-cyber font-mono"
                style={{ fontSize: "0.85rem" }}
              />
              <button
                onClick={() => handleCodeSubmit(2)}
                disabled={submittingSector === 2 || puzzles["2"]?.solved}
                className="btn btn-gold"
                style={{ fontSize: "0.75rem", padding: "8px 16px" }}
              >
                SUBMIT
              </button>
            </div>
            {feedback[2] && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: feedback[2].success ? "#34d399" : "#f87171" }}>
                {feedback[2].message}
              </div>
            )}
          </div>
        </div>

        {/* Sector 3: Hidden Audit Header */}
        <div className="glass-panel" style={{
          padding: 24,
          border: `1px solid ${puzzles["3"]?.solved ? "rgba(16, 185, 129, 0.4)" : "var(--border-subtle)"}`
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span className="badge badge-crimson font-mono">SECTOR 03 // HTTP HEADERS</span>
            <span className={`badge ${puzzles["3"]?.solved ? "badge-emerald" : "badge-gold"}`}>
              {puzzles["3"]?.solved ? "BREACHED" : "LOCKED"}
            </span>
          </div>

          <h3 style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 700, marginBottom: 6 }}>
            The Hidden Audit Header
          </h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
            Your balance response contains a decoy audit code in the JSON body.
            The legitimate access code is transmitted via HTTP headers (<code>X-Audit-Code</code>) on cache refresh.
          </p>

          {/* Quick interactive tester */}
          <div style={{ background: "rgba(0,0,0,0.4)", padding: 14, borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
            <div style={{ fontSize: "0.75rem", color: "var(--cyan)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
              ⚡ HTTP TELEMETRY PROBER
            </div>
            <button onClick={testBalanceHeader} className="btn btn-ghost" style={{ width: "100%", fontSize: "0.7rem", padding: "6px" }}>
              FETCH TELEMETRY HEADERS (CLICK TWICE) →
            </button>

            {balanceDebug && (
              <div style={{ marginTop: 10, fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>
                <div style={{ color: "var(--text-dim)" }}>Body Decoy: {balanceDebug.body?.audit_code}</div>
                <div style={{ color: "var(--gold)", fontWeight: 700 }}>
                  X-Audit-Code: {balanceDebug.auditHeader}
                </div>
              </div>
            )}
          </div>

          {/* Code Authorization */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
              SUBMIT SECTOR 03 CODE:
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={inputCodes[3]}
                onChange={(e) => setInputCodes({ ...inputCodes, 3: e.target.value.toUpperCase() })}
                placeholder="IVB-LEVEL3-..."
                className="input-cyber font-mono"
                style={{ fontSize: "0.85rem" }}
              />
              <button
                onClick={() => handleCodeSubmit(3)}
                disabled={submittingSector === 3 || puzzles["3"]?.solved}
                className="btn btn-gold"
                style={{ fontSize: "0.75rem", padding: "8px 16px" }}
              >
                SUBMIT
              </button>
            </div>
            {feedback[3] && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: feedback[3].success ? "#34d399" : "#f87171" }}>
                {feedback[3].message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
