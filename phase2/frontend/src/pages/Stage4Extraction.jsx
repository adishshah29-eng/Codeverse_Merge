import React, { useState, useEffect } from "react";
import App from "../extraction/App.jsx";
import { Vault } from "../extraction/src.jsx";
import { api } from "../api";
import "../extraction/style.css";

export default function Stage4Extraction({ team, onStageCompleted }) {
  const [teamOutputs, setTeamOutputs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.getExtractionStatus();
      setTeamOutputs(res.outputs_acquired || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitSequence = async (sequence) => {
    const result = await api.submitExtractionSequence(sequence);
    if (result.success) await onStageCompleted(4, result.final_score);
    return result;
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 20px" }}>
      {/* Header telemetry info */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="badge badge-crimson font-mono">STAGE 04 // FINAL EXTRACTION</span>
          <span className="badge badge-gold font-mono">MAX 10.0 PTS + OVERALL HEIST SCORE</span>
        </div>
        <h1 style={{ fontSize: "1.8rem", fontFamily: "var(--font-display)", color: "#fff", marginBottom: 6 }}>
          FINAL EXTRACTION PROTOCOL
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", maxWidth: 900 }}>
          Bring together the four cryptographic credentials from the earlier phases. Authorize all four locks,
          execute the 5-step override sequence before the five-minute countdown expires, and pilot the getaway crew home.
        </p>
      </div>

      {/* Stage outputs inventory strip */}
      <div style={{
        background: "rgba(14, 18, 27, 0.8)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "14px 20px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12
      }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          ACQUIRED KEYS:
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>01/DEL: </span>
            <strong style={{ color: teamOutputs.deletion_key ? "var(--emerald)" : "var(--crimson)" }}>
              {teamOutputs.deletion_key || "NOT ACQUIRED"}
            </strong>
          </div>
          <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>02/SHT: </span>
            <strong style={{ color: "var(--emerald)" }}>
              {teamOutputs.shutdown_code || "NOT ACQUIRED"}
            </strong>
          </div>
          <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>03/CTL: </span>
            <strong style={{ color: teamOutputs.control_token ? "var(--emerald)" : "var(--crimson)" }}>
              {teamOutputs.control_token || "NOT ACQUIRED"}
            </strong>
          </div>
          <div style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>04/ROT: </span>
            <strong style={{ color: teamOutputs.route_code ? "var(--emerald)" : "var(--crimson)" }}>
              {teamOutputs.route_code || "NOT ACQUIRED"}
            </strong>
          </div>
        </div>
      </div>

      {/* Embedded 3D Three.js Extraction Scene & Sequence Console */}
      <div style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        background: "#111014",
        minHeight: 700
      }}>
        <App
          Vault={Vault}
          onVerifyArtifacts={(artifacts) => api.verifyExtractionArtifacts(artifacts)}
          onCompleteSequence={submitSequence}
          onHint={() => api.requestHint("hint_s4_01")}
        />
      </div>
    </div>
  );
}
