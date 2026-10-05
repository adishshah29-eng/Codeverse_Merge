import React, { useState } from "react";

export default function StageStepper({
  stages = [],
  currentStage = 1,
  onSelectStage,
  onSkipStage,
  skipPenalty = 3.0,
}) {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleConfirmSkip = async () => {
    setIsSkipping(true);
    try {
      await onSkipStage(currentStage);
      setShowSkipConfirm(false);
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "20px 24px", marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff" }}>
            MISSION PROGRESSION PIPELINE
          </h2>
          <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            Four security phases to extraction. Max score: 10.0 PTS per sector.
          </p>
        </div>

        {/* Skip Current Stage Action */}
        {currentStage <= 4 && (
          <div>
            <button
              onClick={() => setShowSkipConfirm(true)}
              className="btn btn-ghost"
              style={{
                fontSize: "0.75rem",
                color: "#fca5a5",
                borderColor: "rgba(239, 68, 68, 0.3)",
              }}
            >
              ⏭️ SKIP STAGE 0{currentStage} (-{skipPenalty} PTS PENALTY)
            </button>
          </div>
        )}
      </div>

      {/* Steps Pipeline */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16
      }}>
        {stages.map((stage) => {
          const isCompleted = stage.status === "completed";
          const isSkipped = stage.status === "skipped";
          const isCurrent = stage.id === currentStage;
          const isLocked = stage.status === "locked";
          const canEnter = isCurrent && !isCompleted && !isSkipped;

          let borderColor = "var(--border-subtle)";
          let statusBadge = <span className="badge badge-cyan">OPEN</span>;
          let icon = "🔓";

          if (isCompleted) {
            borderColor = "rgba(16, 185, 129, 0.5)";
            statusBadge = <span className="badge badge-emerald">COMPLETED (+{stage.score} PTS)</span>;
            icon = "✅";
          } else if (isSkipped) {
            borderColor = "rgba(239, 68, 68, 0.5)";
            statusBadge = <span className="badge badge-crimson">SKIPPED (0 PTS)</span>;
            icon = "⏭️";
          } else if (isCurrent) {
            borderColor = "var(--crimson)";
            statusBadge = <span className="badge badge-gold">IN PROGRESS</span>;
            icon = "⚡";
          } else if (isLocked) {
            statusBadge = <span className="badge badge-ghost">LOCKED</span>;
            icon = "🔒";
          }

          return (
            <div
              key={stage.id}
              onClick={() => canEnter && onSelectStage(`stage${stage.id}`)}
              style={{
                background: isCurrent ? "rgba(239, 68, 68, 0.08)" : "var(--bg-surface)",
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--radius-md)",
                padding: "16px",
                cursor: canEnter ? "pointer" : "not-allowed",
                opacity: canEnter ? 1 : 0.62,
                transition: "all 0.2s ease",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "1.2rem" }}>{icon}</span>
                {statusBadge}
              </div>

              <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                PHASE 0{stage.id} // {stage.category}
              </div>

              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", marginTop: 4, marginBottom: 8 }}>
                {stage.title.split("—")[1] || stage.title}
              </div>

              {stage.output_value && (
                <div style={{
                  fontSize: "0.7rem",
                  fontFamily: "var(--font-mono)",
                  background: "rgba(0,0,0,0.4)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--gold)",
                  marginTop: 6
                }}>
                  KEY: {stage.output_value}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skip Confirmation Modal */}
      {showSkipConfirm && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
          padding: 20
        }}>
          <div className="glass-panel" style={{ maxWidth: 500, width: "100%", padding: 28, border: "1px solid var(--crimson)" }}>
            <h3 style={{ fontSize: "1.25rem", color: "#f87171", marginBottom: 12, fontFamily: "var(--font-display)" }}>
              ⚠️ CONFIRM STAGE SKIP
            </h3>
            <p style={{ color: "var(--text-main)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: 16 }}>
              Are you sure you want to skip <strong>Stage 0{currentStage}</strong>?
            </p>
            <div style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-sm)",
              padding: 14,
              marginBottom: 20,
              fontSize: "0.85rem",
              color: "#fca5a5",
              lineHeight: 1.5
            }}>
              • A configurable penalty of <strong>-{skipPenalty} PTS</strong> will be applied.<br />
              • Stage 0{currentStage} will be permanently marked as <strong>SKIPPED</strong> with 0 points.<br />
              • Your team will immediately advance to the next stage.<br />
              • This decision cannot be reversed.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setShowSkipConfirm(false)}
                className="btn btn-ghost"
                disabled={isSkipping}
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmSkip}
                className="btn btn-crimson"
                disabled={isSkipping}
              >
                {isSkipping ? "APPLYING SKIP..." : "PROCEED WITH SKIP"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
