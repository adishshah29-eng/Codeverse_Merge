import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function Stage3OutrunPolice({ team, onStageCompleted }) {
  const [graph, setGraph] = useState(null);
  const [policeState, setPoliceState] = useState(null);
  const [route, setRoute] = useState(["N00", "N15", "N30", "N45", "N59"]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const [g, s] = await Promise.all([api.getPoliceGraph(), api.getPoliceState()]);
      setGraph(g);
      setPoliceState(s);
      if (s.best_route) {
        setRoute(s.best_route);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleNodeClick = (nodeId) => {
    if (route.includes(nodeId)) {
      setRoute(route.filter((n) => n !== nodeId));
    } else {
      setRoute([...route, nodeId]);
    }
  };

  const handlePresetSolve = () => {
    setRoute(["N00", "N15", "N30", "N45", "N59"]);
  };

  const handleSubmitRoute = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      const res = await api.submitPoliceRoute(route);
      if (res.success) {
        setResult(res);
        await loadData();
        if (onStageCompleted) onStageCompleted(3, res.score_awarded);
      } else {
        setError(res.message || "Route rejected");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const compromisedNodes = policeState?.compromised || [];
  const nodes = graph?.nodes || [];

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="badge badge-crimson font-mono">SECTOR 03 // GRAPH OPTIMIZATION</span>
          <span className="badge badge-gold font-mono">MAX 10.0 PTS</span>
        </div>
        <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 6 }}>
          OUTRUN THE POLICE
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 900 }}>
          The police lockdown is actively expanding. Compute a path across 60 city checkpoints from the Hideout (<code>N00</code>)
          to the Extraction Point (<code>N59</code>). Some roads close as the event clock advances, and compromised nodes
          invalidate paths. Minimize overall risk while strictly respecting the 120-minute deadline and 100-credit budget.
        </p>
      </div>

      {/* Telemetry Bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 16,
        marginBottom: 24
      }}>
        <div className="glass-panel" style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            EVENT CHASE CLOCK (t)
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
            t = {policeState?.t?.toFixed(1) || "10.0"} MIN
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            TIME DEADLINE
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", fontFamily: "var(--font-mono)" }}>
            ≤ {policeState?.deadline || 120.0} MIN
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            RESOURCE BUDGET
          </div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--gold)", fontFamily: "var(--font-mono)" }}>
            ≤ {policeState?.budget || 100.0} CREDITS
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            COMPROMISED CHECKPOINTS
          </div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: compromisedNodes.length > 0 ? "var(--crimson)" : "var(--emerald)", fontFamily: "var(--font-mono)" }}>
            {compromisedNodes.length > 0 ? compromisedNodes.join(", ") : "NONE (CLEAR)"}
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map & Route Builder */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24 }}>
        {/* City Map Canvas Box */}
        <div className="glass-panel" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: "1rem", color: "#fff", fontFamily: "var(--font-display)" }}>
              METROPOLITAN CHECKPOINT GRID (60 NODES)
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              Green: Start (N00) • Gold: Escape (N59) • Red: Compromised
            </span>
          </div>

          {/* Nodes grid visualizer */}
          <div style={{
            background: "#05070a",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: 16,
            height: 380,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(65px, 1fr))",
            gap: 8,
            alignContent: "flex-start"
          }}>
            {nodes.map((n) => {
              const isStart = n.id === "N00";
              const isGoal = n.id === "N59";
              const isComp = compromisedNodes.includes(n.id);
              const inRoute = route.includes(n.id);

              let bg = "rgba(255, 255, 255, 0.05)";
              let border = "1px solid rgba(255,255,255,0.1)";
              let color = "#cbd5e1";

              if (isStart) {
                bg = "rgba(16, 185, 129, 0.25)";
                border = "1px solid var(--emerald)";
                color = "#a7f3d0";
              } else if (isGoal) {
                bg = "rgba(245, 158, 11, 0.25)";
                border = "1px solid var(--gold)";
                color = "#fde68a";
              } else if (isComp) {
                bg = "rgba(239, 68, 68, 0.3)";
                border = "1px solid var(--crimson)";
                color = "#fca5a5";
              } else if (inRoute) {
                bg = "rgba(6, 182, 212, 0.25)";
                border = "1px solid var(--cyan)";
                color = "#a5f3fc";
              }

              return (
                <button
                  key={n.id}
                  onClick={() => handleNodeClick(n.id)}
                  style={{
                    background: bg,
                    border,
                    color,
                    borderRadius: "var(--radius-sm)",
                    padding: "8px 4px",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                  title={n.label || n.id}
                >
                  {n.id}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Selected Route Length: <strong>{route.length} Checkpoints</strong>
            </span>
            <button onClick={handlePresetSolve} className="btn btn-ghost" style={{ fontSize: "0.75rem" }}>
              ⚡ LOAD DIJKSTRA CONSTRAINED VECTOR
            </button>
          </div>
        </div>

        {/* Route Builder & Submission Panel */}
        <div className="glass-panel" style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", color: "#fff", fontFamily: "var(--font-display)", marginBottom: 12 }}>
              ESCAPE VECTOR BUILDER
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 16 }}>
              Route must begin at <code>N00</code> and terminate at <code>N59</code> through open edges.
            </p>

            {/* Current Route Path */}
            <div style={{
              background: "rgba(0,0,0,0.5)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              padding: 14,
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
              color: "#a5f3fc",
              lineHeight: 1.6,
              wordBreak: "break-all",
              marginBottom: 16
            }}>
              {route.join(" → ")}
            </div>

            {error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                padding: 12,
                borderRadius: "var(--radius-sm)",
                fontSize: "0.85rem",
                marginBottom: 16
              }}>
                [REJECTED] {error}
              </div>
            )}

            {result && (
              <div style={{
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#a7f3d0",
                padding: 14,
                borderRadius: "var(--radius-sm)",
                marginBottom: 16
              }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  ✓ {result.message}
                </div>
                <div style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>
                  Risk: {result.risk} • Time: {result.time}m • Cost: €{result.cost}
                </div>
                <div style={{
                  background: "rgba(0,0,0,0.4)",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--gold)",
                  fontWeight: 700,
                  marginTop: 8,
                  fontFamily: "var(--font-mono)"
                }}>
                  AUTHORITATIVE ROUTE CODE: {result.route_code}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmitRoute}>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-crimson"
              style={{ width: "100%", padding: "12px" }}
            >
              {submitting ? "VALIDATING CONSTRAINTS..." : "AUTHORIZE ESCAPE ROUTE →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
