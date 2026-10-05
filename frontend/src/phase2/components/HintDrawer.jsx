import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function HintDrawer({ isOpen, onClose, onHintUsed }) {
  const [hints, setHints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unlockingId, setUnlockingId] = useState(null);
  const [error, setError] = useState("");

  const loadHints = async () => {
    setLoading(true);
    try {
      const res = await api.getHints();
      setHints(res.hints || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHints();
    }
  }, [isOpen]);

  const handleRequestHint = async (hintId) => {
    setUnlockingId(hintId);
    setError("");
    try {
      const res = await api.requestHint(hintId);
      await loadHints();
      if (onHintUsed) onHintUsed(res.penalty_applied);
    } catch (err) {
      setError(err.message);
    } finally {
      setUnlockingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.7)",
      backdropFilter: "blur(6px)",
      zIndex: 100,
      display: "flex",
      justifyContent: "flex-end"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 480,
        height: "100%",
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.6)"
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <h3 style={{ fontSize: "1.1rem", fontFamily: "var(--font-display)", color: "#fff" }}>
              💡 HEIST INTEL & HINTS
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Official Professor Intel Wire // Configurable Penalties
            </span>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: "4px 10px" }}>
            ✕
          </button>
        </div>

        {/* Drawer Body */}
        <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "#fca5a5",
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 16,
              fontSize: "0.85rem"
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 40 }}>
              Connecting to encrypted intel wire...
            </div>
          ) : hints.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-dim)", padding: 40, lineHeight: 1.6 }}>
              No intelligence released by the organizers for your active sector yet.<br />
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Organizers can issue live intel as the operation unfolds.
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {hints.map((hint) => (
                <div
                  key={hint.id}
                  style={{
                    background: hint.is_unlocked ? "rgba(245, 158, 11, 0.05)" : "var(--bg-surface-elevated)",
                    border: `1px solid ${hint.is_unlocked ? "rgba(245, 158, 11, 0.4)" : "var(--border-subtle)"}`,
                    borderRadius: "var(--radius-md)",
                    padding: 18
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span className="badge badge-gold" style={{ fontSize: "0.65rem" }}>
                      STAGE 0{hint.stage}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#f87171", fontFamily: "var(--font-mono)" }}>
                      -{hint.penalty} PTS PENALTY
                    </span>
                  </div>

                  <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", marginBottom: 8 }}>
                    {hint.title}
                  </h4>

                  {hint.is_unlocked ? (
                    <div style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "1px solid rgba(245, 158, 11, 0.2)",
                      borderRadius: "var(--radius-sm)",
                      padding: 12,
                      fontSize: "0.85rem",
                      color: "#fde68a",
                      lineHeight: 1.5,
                      fontFamily: "var(--font-mono)"
                    }}>
                      "{hint.body}"
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: 12 }}>
                        Classified intel available. Unlocking will deduct {hint.penalty} point(s) from your team score.
                      </p>
                      <button
                        onClick={() => handleRequestHint(hint.id)}
                        disabled={unlockingId === hint.id}
                        className="btn btn-outline-gold"
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      >
                        {unlockingId === hint.id ? "DECRYPTING INTEL..." : `UNLOCK INTEL (-${hint.penalty} PTS)`}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
