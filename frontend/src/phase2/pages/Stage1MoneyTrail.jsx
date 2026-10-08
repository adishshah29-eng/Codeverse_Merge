import React, { useState, useEffect } from "react";
import StageBrief from "../components/StageBrief";
import { api } from "../api";

export default function Stage1MoneyTrail({ team, onStageCompleted }) {
  const [schema, setSchema] = useState([]);
  const [query, setQuery] = useState("SELECT * FROM transactions WHERE amount > 1000000;");
  const [queryResults, setQueryResults] = useState(null);
  const [queryError, setQueryError] = useState("");
  const [runningQuery, setRunningQuery] = useState(false);

  const [deletionKey, setDeletionKey] = useState("");
  const [submittingKey, setSubmittingKey] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  useEffect(() => {
    loadSchema();
    handleRunQuery("SELECT * FROM transactions WHERE amount > 1000000;");
  }, []);

  const loadSchema = async () => {
    try {
      const res = await api.getMoneyTrailSchema();
      setSchema(res.tables || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunQuery = async (customQuery) => {
    const q = customQuery || query;
    setRunningQuery(true);
    setQueryError("");
    try {
      const res = await api.runMoneyTrailQuery(q);
      if (res.success) {
        setQueryResults(res);
      } else {
        setQueryError(res.error || "Query failed");
        setQueryResults(null);
      }
    } catch (err) {
      setQueryError(err.message);
      setQueryResults(null);
    } finally {
      setRunningQuery(false);
    }
  };

  const handleSubmitKey = async (e) => {
    e.preventDefault();
    if (!deletionKey.trim()) return;

    setSubmittingKey(true);
    setSubmitFeedback(null);
    try {
      const res = await api.submitDeletionKey(deletionKey.trim());
      setSubmitFeedback(res);
      if (res.success && onStageCompleted) {
        onStageCompleted(1, res.score_awarded);
      }
    } catch (err) {
      setSubmitFeedback({ success: false, message: err.message });
    } finally {
      setSubmittingKey(false);
    }
  };

  const presetQueries = [
    { label: "High-Value Transfers", sql: "SELECT * FROM transactions WHERE amount > 1000000;" },
    { label: "Core Server Badge Swipes", sql: "SELECT * FROM access_cards WHERE door_location LIKE '%Server%' ORDER BY timestamp DESC;" },
    { label: "Night Terminal Sessions", sql: "SELECT * FROM terminal_logs WHERE login_time >= '2026-10-03 02:00:00';" },
    { label: "Critical Alarm Events", sql: "SELECT * FROM security_events WHERE severity = 'CRITICAL';" },
    { label: "All Employees & Clearance", sql: "SELECT emp_id, name, department, clearance_level, active_badge_id FROM employees;" },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px" }}>
      <StageBrief stage={1} />

      {/* Main Forensic Workstation Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, marginBottom: 28 }}>
        {/* Left: Forensic Schema Explorer */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <h3 style={{ fontSize: "0.95rem", fontFamily: "var(--font-display)", color: "var(--cyan)", marginBottom: 12 }}>
            📂 FORENSIC TABLES
          </h3>
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: 16 }}>
            Select a table to inspect schema or build custom correlation joins.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {schema.map((tbl) => (
              <div
                key={tbl.name}
                onClick={() => {
                  const newQ = `SELECT * FROM ${tbl.name} LIMIT 10;`;
                  setQuery(newQ);
                  handleRunQuery(newQ);
                }}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono)" }}>
                  {tbl.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", marginTop: 2 }}>
                  {tbl.description}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24, borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
            <h4 style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
              ⚡ QUICK INVESTIGATIONS
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {presetQueries.map((pq) => (
                <button
                  key={pq.label}
                  onClick={() => { setQuery(pq.sql); handleRunQuery(pq.sql); }}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.7rem", justifyContent: "flex-start", padding: "6px 8px" }}
                >
                  › {pq.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Interactive Terminal & SQL Runner */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* SQL Terminal Box */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1rem" }}>💻</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>
                  SQL FORENSICS QUERY CONSOLE
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                READ-ONLY FORENSIC REPL // SQLITE
              </span>
            </div>

            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              className="input-cyber"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                color: "#a5f3fc",
                background: "#05070b",
                resize: "vertical",
                marginBottom: 12
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => handleRunQuery()}
                disabled={runningQuery}
                className="btn btn-crimson"
                style={{ fontSize: "0.75rem", padding: "8px 18px" }}
              >
                {runningQuery ? "EXECUTING REPL..." : "RUN FORENSIC QUERY (F5) →"}
              </button>
            </div>
          </div>

          {/* Results Table Box */}
          <div className="glass-panel" style={{ padding: 20, minHeight: 280, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h4 style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                FORENSIC DATA RESULTS {queryResults ? `(${queryResults.row_count} rows)` : ""}
              </h4>
            </div>

            {queryError && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                color: "#fca5a5",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem"
              }}>
                [ERROR] {queryError}
              </div>
            )}

            {queryResults && queryResults.rows && (
              <div style={{ overflowX: "auto", flex: 1, maxHeight: 320 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
                  <thead>
                    <tr style={{ background: "rgba(255, 255, 255, 0.05)", borderBottom: "1px solid var(--border-subtle)" }}>
                      {queryResults.columns.map((col) => (
                        <th key={col} style={{ padding: "8px 12px", textAlign: "left", color: "var(--gold)" }}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queryResults.rows.map((row, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                          background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"
                        }}
                      >
                        {queryResults.columns.map((col) => (
                          <td key={col} style={{ padding: "8px 12px", color: "#e2e8f0" }}>
                            {typeof row[col] === "object" ? JSON.stringify(row[col]) : String(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verification & Key Submission Box */}
      <div className="glass-panel" style={{
        padding: "24px 28px",
        border: "1px solid var(--border-gold)",
        boxShadow: "0 0 30px rgba(245, 158, 11, 0.1)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 4 }}>
              🗝️ AUTHORIZE DELETION KEY
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Once you correlate the unauthorized server breach with the rogue wire transaction, enter the derivation key.
            </p>
          </div>

          <form onSubmit={handleSubmitKey} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={deletionKey}
              onChange={(e) => setDeletionKey(e.target.value.toUpperCase())}
              placeholder="e.g. ERASE-XXXX"
              className="input-cyber font-mono"
              style={{ width: 220, fontSize: "1rem", letterSpacing: "0.1em", fontWeight: 700 }}
              required
            />
            <button
              type="submit"
              disabled={submittingKey}
              className="btn btn-gold"
              style={{ padding: "10px 24px" }}
            >
              {submittingKey ? "VERIFYING..." : "SUBMIT KEY →"}
            </button>
          </form>
        </div>

        {submitFeedback && (
          <div style={{
            marginTop: 16,
            padding: 16,
            borderRadius: "var(--radius-sm)",
            background: submitFeedback.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
            border: `1px solid ${submitFeedback.success ? "rgba(16, 185, 129, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
            color: submitFeedback.success ? "#a7f3d0" : "#fca5a5",
            fontSize: "0.9rem"
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {submitFeedback.success ? "✓ VERIFICATION SUCCESSFUL" : "✕ VERIFICATION REJECTED"}
            </div>
            <div>{submitFeedback.message}</div>
            {submitFeedback.details && (
              <div style={{ marginTop: 8, fontSize: "0.8rem", color: "#fff", fontFamily: "var(--font-mono)" }}>
                Key Derived: {submitFeedback.details.deletion_key} • Rogue Txn: {submitFeedback.details.rogue_txn} • Badge: {submitFeedback.details.rogue_badge}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
