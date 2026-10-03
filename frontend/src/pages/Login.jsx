import React, { useState } from "react";
import { api, setToken } from "../api";

export default function Login({ onLoginSuccess }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [code, setCode] = useState("TEAM01");
  const [password, setPassword] = useState("heist");
  const [adminUser, setAdminUser] = useState("admin");
  const [adminPass, setAdminPass] = useState("admin");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isAdminMode) {
        const res = await api.adminLogin(adminUser, adminPass);
        setToken(res.token);
        onLoginSuccess("admin", { username: res.username });
      } else {
        const res = await api.login(code, password);
        setToken(res.token);
        onLoginSuccess("team", res.team);
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Check your access credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      background: "radial-gradient(circle at 50% 30%, rgba(239, 68, 68, 0.12) 0%, transparent 60%)"
    }}>
      <div className="glass-panel" style={{
        maxWidth: 460,
        width: "100%",
        padding: "36px 32px",
        border: "1px solid rgba(239, 68, 68, 0.3)",
        boxShadow: "0 0 50px rgba(0,0,0,0.8), 0 0 30px rgba(239,68,68,0.2)"
      }}>
        {/* Header Icon & Title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            fontSize: "3.2rem",
            marginBottom: 8,
            filter: "drop-shadow(0 0 15px rgba(239, 68, 68, 0.6))"
          }}>
            🎭
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            color: "#fff",
            letterSpacing: "0.1em",
            marginBottom: 4
          }}>
            OPERACIÓN FUGA
          </h1>
          <p style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--crimson)",
            letterSpacing: "0.15em",
            textTransform: "uppercase"
          }}>
            CODEVERSE 2.0 // MISSION INFILTRATION TERMINAL
          </p>
        </div>

        {/* Toggle Mode */}
        <div style={{
          display: "flex",
          background: "rgba(0,0,0,0.4)",
          borderRadius: "var(--radius-sm)",
          padding: 4,
          marginBottom: 24,
          border: "1px solid var(--border-subtle)"
        }}>
          <button
            type="button"
            onClick={() => { setIsAdminMode(false); setError(""); }}
            style={{
              flex: 1,
              padding: "8px",
              background: !isAdminMode ? "var(--crimson)" : "transparent",
              color: !isAdminMode ? "#fff" : "var(--text-dim)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            👥 TEAM SQUAD LOGIN
          </button>
          <button
            type="button"
            onClick={() => { setIsAdminMode(true); setError(""); }}
            style={{
              flex: 1,
              padding: "8px",
              background: isAdminMode ? "var(--gold)" : "transparent",
              color: isAdminMode ? "#090d15" : "var(--text-dim)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontWeight: 700,
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            🛡️ ORGANIZER PANEL
          </button>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
            padding: "10px 14px",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            marginBottom: 20
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {!isAdminMode ? (
            <>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                  TEAM ACCESS CODE
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. TEAM01"
                  className="input-cyber"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                  PASSPHRASE
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-cyber"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                  ADMIN USERNAME
                </label>
                <input
                  type="text"
                  value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)}
                  className="input-cyber"
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
                  ADMIN PASSWORD
                </label>
                <input
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="input-cyber"
                  required
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`btn ${isAdminMode ? "btn-gold" : "btn-crimson"}`}
            style={{ width: "100%", padding: "12px", marginTop: 8 }}
          >
            {loading ? "AUTHENTICATING..." : isAdminMode ? "ENTER COMMAND CONSOLE →" : "INFILTRATE SYSTEM →"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Default test teams: <code>TEAM01</code> through <code>TEAM10</code> (Pass: <code>heist</code>)
          </p>
        </div>
      </div>
    </div>
  );
}
