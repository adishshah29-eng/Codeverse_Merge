import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [hints, setHints] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(true);
  const [teamForm, setTeamForm] = useState({ code: "", name: "", email: "", password: "" });
  const [teamFeedback, setTeamFeedback] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);

  // Penalty form
  const [selectedTeamId, setSelectedTeamId] = useState(1);
  const [penaltyAmount, setPenaltyAmount] = useState(2.0);
  const [penaltyReason, setPenaltyReason] = useState("Rule Infraction: Unauthorized external communication");
  const [penaltyFeedback, setPenaltyFeedback] = useState("");

  // Police compromise form
  const [compromiseNode, setCompromiseNode] = useState("N22");
  const [compromiseAction, setCompromiseAction] = useState("add");
  const [compromiseTeamId, setCompromiseTeamId] = useState("");
  const [compromiseFeedback, setCompromiseFeedback] = useState("");

  const loadAll = async () => {
    try {
      const [dashRes, hintsRes, auditRes] = await Promise.all([
        api.getAdminDashboard(),
        api.listAdminHints(),
        api.getAdminAuditEvents(),
      ]);
      setData(dashRes);
      setHints(hintsRes.hints || []);
      setAuditEvents(auditRes.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      if (refreshInterval) loadAll();
    }, 5000);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleToggleHint = async (hintId, currentStatus) => {
    try {
      await api.toggleAdminHint(hintId, !currentStatus);
      await loadAll();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApplyPenalty = async (e) => {
    e.preventDefault();
    setPenaltyFeedback("");
    try {
      const res = await api.applyAdminPenalty(selectedTeamId, penaltyAmount, penaltyReason);
      setPenaltyFeedback(res.message);
      await loadAll();
    } catch (err) {
      setPenaltyFeedback(`Error: ${err.message}`);
    }
  };

  const handleCompromiseNode = async (e) => {
    e.preventDefault();
    setCompromiseFeedback("");
    try {
      const teamId = compromiseTeamId ? parseInt(compromiseTeamId, 10) : null;
      const res = await api.compromisePoliceNode(compromiseNode, compromiseAction, teamId);
      setCompromiseFeedback(res.message);
      await loadAll();
    } catch (err) {
      setCompromiseFeedback(`Error: ${err.message}`);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    setTeamFeedback("");
    setTeamSaving(true);
    try {
      const res = await api.createAdminTeam(teamForm);
      setTeamFeedback(res.message);
      setTeamForm({ code: "", name: "", email: "", password: "" });
      await loadAll();
    } catch (err) {
      setTeamFeedback(`Error: ${err.message}`);
    } finally {
      setTeamSaving(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`Delete ${team.code} (${team.name}) and its game progress?`)) return;
    setTeamFeedback("");
    try {
      const res = await api.deleteAdminTeam(team.id);
      setTeamFeedback(res.message);
      await loadAll();
    } catch (err) {
      setTeamFeedback(`Error: ${err.message}`);
    }
  };

  const teams = data?.teams || [];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px" }}>
      {/* Top Banner */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 28
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span className="badge badge-crimson font-mono">ORGANIZER MAIN CONSOLE</span>
            <span className="badge badge-gold font-mono">CODEVERSE 2.0 // COMMAND</span>
          </div>
          <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-display)", color: "#fff" }}>
            EVENT SUPERVISOR DASHBOARD
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Authoritative telemetry stream, live team monitoring, real-time hint releases, penalty adjustments, and dynamic city map compromises.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setRefreshInterval(!refreshInterval)}
            className={`btn ${refreshInterval ? "btn-emerald" : "btn-ghost"}`}
            style={{ fontSize: "0.75rem" }}
          >
            {refreshInterval ? "● LIVE STREAM (5S AUTO)" : "⏸ PAUSED"}
          </button>
          <button onClick={loadAll} className="btn btn-ghost" style={{ fontSize: "0.75rem" }}>
            🔄 REFRESH NOW
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 28
      }}>
        <div className="glass-panel" style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            ACTIVE SQUADS REGISTERED
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)", marginTop: 4 }}>
            {teams.length} TEAMS
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            POLICE CLOCK TIME (t)
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
            t = {data?.police_clock_t?.toFixed(1) || "10.0"} MIN
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            GLOBAL COMPROMISED NODES
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--crimson)", fontFamily: "var(--font-mono)", marginTop: 6 }}>
            {data?.compromised_nodes?.length > 0 ? data.compromised_nodes.join(", ") : "NONE (CLEAR)"}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            TEAMS EXTRACTED
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--emerald)", fontFamily: "var(--font-mono)", marginTop: 4 }}>
            {teams.filter((t) => t.final_score !== null).length} / {teams.length}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 24, marginBottom: 28 }}>
        <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 14 }}>
          TEAM ACCOUNTS
        </h3>
        <form onSubmit={handleCreateTeam} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "end" }}>
          <label style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
            TEAM CODE
            <input className="input-cyber" style={{ marginTop: 5 }} value={teamForm.code} onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value })} maxLength={32} required />
          </label>
          <label style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
            TEAM NAME
            <input className="input-cyber" style={{ marginTop: 5 }} value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} maxLength={120} required />
          </label>
          <label style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
            LOGIN EMAIL
            <input className="input-cyber" style={{ marginTop: 5 }} type="email" value={teamForm.email} onChange={(e) => setTeamForm({ ...teamForm, email: e.target.value })} required />
          </label>
          <label style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
            PASSWORD
            <input className="input-cyber" style={{ marginTop: 5 }} type="password" value={teamForm.password} onChange={(e) => setTeamForm({ ...teamForm, password: e.target.value })} minLength={8} autoComplete="new-password" required />
          </label>
          <button type="submit" className="btn btn-emerald" disabled={teamSaving}>
            {teamSaving ? "CREATING..." : "ADD TEAM"}
          </button>
        </form>
        {teamFeedback && <p role="status" style={{ marginTop: 12, color: teamFeedback.startsWith("Error:") ? "#f87171" : "#34d399", fontSize: "0.8rem" }}>{teamFeedback}</p>}
        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead><tr style={{ color: "var(--text-dim)", textAlign: "left" }}><th style={{ padding: 8 }}>CODE</th><th style={{ padding: 8 }}>TEAM</th><th style={{ padding: 8 }}>ACCOUNT</th><th style={{ padding: 8 }}></th></tr></thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <td style={{ padding: 8, color: "var(--gold)", fontFamily: "var(--font-mono)" }}>{team.code}</td>
                  <td style={{ padding: 8, color: "#fff" }}>{team.name}</td>
                  <td style={{ padding: 8, color: "var(--text-muted)" }}>{team.has_login ? "Supabase Auth" : "No linked account"}</td>
                  <td style={{ padding: 8, textAlign: "right" }}><button type="button" className="btn btn-ghost" style={{ color: "#f87171", fontSize: "0.75rem" }} onClick={() => handleDeleteTeam(team)}>DELETE</button></td>
                </tr>
              ))}
              {teams.length === 0 && <tr><td colSpan={4} style={{ padding: 12, color: "var(--text-dim)" }}>No teams yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Teams Telemetry Table */}
      <div className="glass-panel" style={{ padding: 24, marginBottom: 28 }}>
        <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 16 }}>
          📊 LIVE TEAM TELEMETRY & PROGRESSION
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", color: "var(--gold)" }}>CODE / NAME</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "#cbd5e1" }}>PHASE</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "#cbd5e1" }}>SCORES (S1..S4)</th>
                <th style={{ padding: "10px 14px", textAlign: "right", color: "var(--emerald)" }}>TOTAL SCORE</th>
                <th style={{ padding: "10px 14px", textAlign: "right", color: "var(--gold)" }}>FUNDS</th>
                <th style={{ padding: "10px 14px", textAlign: "right", color: "var(--crimson)" }}>RISK</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "#cbd5e1" }}>HINTS</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "#fca5a5" }}>PENALTIES</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "var(--cyan)" }}>MARKET</th>
                <th style={{ padding: "10px 14px", textAlign: "center", color: "#fff" }}>FINAL SCORE</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, color: "#fff" }}>{t.code}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>{t.name}</div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <span className="badge badge-cyan font-mono" style={{ fontSize: "0.7rem" }}>
                      STAGE 0{t.current_stage}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {[1, 2, 3, 4].map((s) => {
                        const isComp = t.completed_stages?.includes(s);
                        const isSkip = t.skipped_stages?.includes(s);
                        const score = t.stage_scores?.[s] || 0;
                        return (
                          <span
                            key={s}
                            style={{
                              padding: "2px 6px",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "0.7rem",
                              background: isComp ? "rgba(16, 185, 129, 0.2)" : isSkip ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.05)",
                              color: isComp ? "#34d399" : isSkip ? "#f87171" : "var(--text-dim)",
                              border: `1px solid ${isComp ? "rgba(16, 185, 129, 0.4)" : isSkip ? "rgba(239, 68, 68, 0.4)" : "rgba(255,255,255,0.1)"}`
                            }}
                            title={`Stage ${s}: ${score} pts`}
                          >
                            S{s}:{score}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--emerald)", fontWeight: 700 }}>
                    {t.total_score} PTS
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--gold)" }}>
                    €{t.money.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "var(--crimson)" }}>
                    {t.risk.toFixed(1)}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    {t.hints_used} used
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center", color: t.total_penalties_amount > 0 ? "#f87171" : "var(--text-dim)" }}>
                    -{t.total_penalties_amount} PTS ({t.penalties_count})
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    {t.black_market_purchases} buys (+{t.black_market_purchases * 25}%)
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center" }}>
                    {t.final_score !== null ? (
                      <span className="badge badge-emerald" style={{ fontWeight: 800 }}>
                        {t.final_score} PTS
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>IN PROGRESS</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Middle Grid: Dynamic Hint Release + Penalty Management + Police Lockdown */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginBottom: 28 }}>
        {/* Dynamic Hint Catalog Controller */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff" }}>
              💡 DYNAMIC HINT RELEASE
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Organizer Controls
            </span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
            Enable hints in real time as the competition progresses. Participants can only request hints you have toggled ON.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto" }}>
            {hints.map((h) => (
              <div
                key={h.id}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${h.enabled ? "rgba(16, 185, 129, 0.4)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    STAGE 0{h.stage} // -{h.penalty} PTS
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>
                    {h.title}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleHint(h.id, h.enabled)}
                  className={`btn ${h.enabled ? "btn-emerald" : "btn-ghost"}`}
                  style={{ fontSize: "0.7rem", padding: "4px 10px" }}
                >
                  {h.enabled ? "✓ RELEASED" : "LOCKED"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Organizer Penalty Issuer */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 12 }}>
            ⚖️ APPLY CUSTOM PENALTY
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
            Apply official rule-infraction penalties to any squad. Automatically deducted server-side.
          </p>

          <form onSubmit={handleApplyPenalty} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
                TARGET SQUAD:
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                className="input-cyber"
                style={{ fontSize: "0.85rem" }}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} — {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
                  POINTS:
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(Number(e.target.value))}
                  className="input-cyber"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
                  REASON / INFRACTION:
                </label>
                <input
                  type="text"
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  className="input-cyber"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-crimson" style={{ marginTop: 8 }}>
              APPLY PENALTY TO TEAM →
            </button>
          </form>

          {penaltyFeedback && (
            <div style={{ marginTop: 12, fontSize: "0.8rem", color: "#34d399", fontFamily: "var(--font-mono)" }}>
              {penaltyFeedback}
            </div>
          )}
        </div>

        {/* Police Lockdown Node Compromise Controller */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 12 }}>
            🚔 POLICE EMERGENCY COMPROMISE
          </h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
            Dynamically flag city map nodes as compromised in real time during the event chase.
          </p>

          <form onSubmit={handleCompromiseNode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
                  CHECKPOINT NODE ID:
                </label>
                <input
                  type="text"
                  value={compromiseNode}
                  onChange={(e) => setCompromiseNode(e.target.value.toUpperCase())}
                  placeholder="e.g. N22"
                  className="input-cyber font-mono"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
                  ACTION:
                </label>
                <select
                  value={compromiseAction}
                  onChange={(e) => setCompromiseAction(e.target.value)}
                  className="input-cyber"
                >
                  <option value="add">COMPROMISE (LOCK)</option>
                  <option value="remove">CLEAR (UNLOCK)</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 4 }}>
                SCOPE (OPTIONAL):
              </label>
              <select
                value={compromiseTeamId}
                onChange={(e) => setCompromiseTeamId(e.target.value)}
                className="input-cyber"
              >
                <option value="">GLOBAL (ALL SQUADS)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    ONLY FOR: {t.code} ({t.name})
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-gold" style={{ marginTop: 8 }}>
              UPDATE POLICE LOCKDOWN VECTOR →
            </button>
          </form>

          {compromiseFeedback && (
            <div style={{ marginTop: 12, fontSize: "0.8rem", color: "var(--gold)", fontFamily: "var(--font-mono)" }}>
              {compromiseFeedback}
            </div>
          )}
        </div>
      </div>

      {/* Live Audit Event Stream */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 16 }}>
          📜 IMMUTABLE AUDIT LOG STREAM
        </h3>

        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {auditEvents.map((evt) => (
            <div
              key={evt.id}
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: "var(--text-dim)" }}>
                  {new Date(evt.created_at).toLocaleTimeString()}
                </span>
                <span className="badge badge-crimson" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                  {evt.event_type}
                </span>
                <span style={{ color: "#fff" }}>
                  Team: {evt.team_id ? `ID #${evt.team_id}` : "GLOBAL"}
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  {typeof evt.payload === "object" ? JSON.stringify(evt.payload) : String(evt.payload)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
