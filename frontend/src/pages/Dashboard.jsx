import React from "react";
import StageStepper from "../components/StageStepper";

export default function Dashboard({
  team,
  stages = [],
  onSelectStage,
  onSkipStage,
  onOpenMarket,
  onOpenHints,
}) {
  const currentStage = team?.current_stage || 1;
  const stageScores = team?.stage_scores || {};
  const totalScore = Object.values(stageScores).reduce((a, b) => a + b, 0);

  const outputs = [
    {
      key: "deletion_key",
      name: "Deletion Key",
      stage: "Stage 01",
      val: stages.find((s) => s.id === 1)?.output_value || "NOT ACQUIRED",
      ready: Boolean(stages.find((s) => s.id === 1)?.output_value),
    },
    {
      key: "shutdown_code",
      name: "Shutdown Code",
      stage: "Vault Mainframe",
      val: currentStage >= 4 ? "READY FOR VERIFICATION" : "LOCKED UNTIL STAGE 04",
      ready: currentStage >= 4,
    },
    {
      key: "control_token",
      name: "Control Server Token",
      stage: "Stage 02",
      val: stages.find((s) => s.id === 2)?.output_value || "NOT ACQUIRED",
      ready: Boolean(stages.find((s) => s.id === 2)?.output_value),
    },
    {
      key: "route_code",
      name: "Escape Route Code",
      stage: "Stage 03",
      val: stages.find((s) => s.id === 3)?.output_value || "NOT ACQUIRED",
      ready: Boolean(stages.find((s) => s.id === 3)?.output_value),
    },
  ];

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
          <h1 style={{
            fontSize: "1.8rem",
            fontFamily: "var(--font-display)",
            color: "#fff",
            marginBottom: 6
          }}>
            MISSION CONTROL // SQUAD {team?.code}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            The Royal Mint escape in progress. Correlate intel, bypass control vectors, outrun police, and extract the crew.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onOpenHints} className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
            💡 REQUEST INTEL
          </button>
          <button onClick={onOpenMarket} className="btn btn-gold" style={{ fontSize: "0.8rem" }}>
            🛒 SHADOW MARKET
          </button>
        </div>
      </div>

      {/* 4 Telemetry Metrics Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 28
      }}>
        <div className="glass-panel" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
            AVAILABLE HEIST FUNDS
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--gold)", fontFamily: "var(--font-mono)" }}>
            €{(team?.money || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 6 }}>
            Use for tactical advantages in Black Market
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
            ACCUMULATED RISK LEVEL
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--crimson)", fontFamily: "var(--font-mono)" }}>
            {(team?.risk || 0).toFixed(1)} <span style={{ fontSize: "1rem" }}>RISK</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 6 }}>
            Higher risk reduces Final Extraction score
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
            ACTIVE PHASE
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
            STAGE 0{currentStage}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 6 }}>
            {stages.find((s) => s.id === currentStage)?.title || "Operation Escape"}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px 24px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
            STAGE SCORE TOTAL
          </div>
          <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--emerald)", fontFamily: "var(--font-mono)" }}>
            {totalScore.toFixed(1)} <span style={{ fontSize: "1rem" }}>/ 40.0</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: 6 }}>
            Max 10.0 PTS per security sector
          </div>
        </div>
      </div>

      {/* Stage Stepper Pipeline */}
      <StageStepper
        stages={stages}
        currentStage={currentStage}
        onSelectStage={onSelectStage}
        onSkipStage={onSkipStage}
      />

      {/* Bottom Grid: Required Cryptographic Artifacts + Quick Infiltration Launchers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 8 }}>
        {/* Artifacts Card */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff" }}>
              🔑 EXTRACTION ARTIFACTS
            </h3>
            <span className="badge badge-gold" style={{ fontSize: "0.7rem" }}>
              {outputs.filter((o) => o.ready).length} / 4 READY
            </span>
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
            Stage 4 (Final Extraction) requires all 4 artifacts to bypass the vault security mainframe.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {outputs.map((out) => (
              <div
                key={out.key}
                style={{
                  background: "var(--bg-surface)",
                  border: `1px solid ${out.ready ? "rgba(16, 185, 129, 0.4)" : "var(--border-subtle)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {out.stage}
                  </div>
                  <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                    {out.name}
                  </div>
                </div>

                <div style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.85rem",
                  color: out.ready ? "var(--emerald)" : "var(--text-dim)",
                  background: "rgba(0,0,0,0.4)",
                  padding: "4px 10px",
                  borderRadius: "var(--radius-sm)"
                }}>
                  {out.ready ? out.val : "LOCKED"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Launch Operations Card */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 16 }}>
            ⚡ LAUNCH ACTIVE CHALLENGE
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {stages.map((stage) => {
              const isLocked = stage.id !== currentStage || ["completed", "skipped"].includes(stage.status);
              return (
                <div
                  key={stage.id}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)",
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff" }}>
                      {stage.title}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                      {stage.category} • Max {stage.max_score} PTS
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectStage(`stage${stage.id}`)}
                    disabled={isLocked}
                    className={`btn ${stage.id === currentStage ? "btn-crimson" : "btn-ghost"}`}
                    style={{ fontSize: "0.75rem", padding: "6px 14px" }}
                  >
                    {isLocked ? "LOCKED" : stage.id === currentStage ? "ENTER SECTOR →" : "REVIEW →"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
