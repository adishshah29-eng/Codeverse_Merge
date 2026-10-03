import React from "react";

export default function Navbar({
  team,
  role,
  activeView,
  setActiveView,
  onOpenMarket,
  onOpenHints,
  onLogout,
}) {
  return (
    <header style={{
      borderBottom: "1px solid var(--border-subtle)",
      background: "rgba(7, 9, 14, 0.85)",
      backdropFilter: "blur(16px)",
      position: "sticky",
      top: 0,
      zIndex: 50,
      padding: "12px 24px"
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap"
      }}>
        {/* Brand */}
        <div 
          onClick={() => setActiveView(role === "admin" ? "admin" : "dashboard")}
          style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
        >
          <div style={{
            fontSize: "1.8rem",
            filter: "drop-shadow(0 0 10px rgba(239, 68, 68, 0.5))"
          }}>
            🎭
          </div>
          <div>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 900,
              letterSpacing: "0.1em",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 8
            }}>
              OPERACIÓN FUGA
              <span className="badge badge-crimson" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>
                CODEVERSE 2.0
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
              CENTRAL COMMAND SYSTEM // THE ESCAPE
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        {role === "team" && (
          <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => setActiveView("dashboard")}
              className={`btn ${activeView === "dashboard" ? "btn-crimson" : "btn-ghost"}`}
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              📊 DASHBOARD
            </button>
            <button
              onClick={() => setActiveView("stage1")}
              className={`btn ${activeView === "stage1" ? "btn-crimson" : "btn-ghost"}`}
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              1. MONEY TRAIL
            </button>
            <button
              onClick={() => setActiveView("stage2")}
              className={`btn ${activeView === "stage2" ? "btn-crimson" : "btn-ghost"}`}
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              2. CONTROL SERVER
            </button>
            <button
              onClick={() => setActiveView("stage3")}
              className={`btn ${activeView === "stage3" ? "btn-crimson" : "btn-ghost"}`}
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              3. OUTRUN POLICE
            </button>
            <button
              onClick={() => setActiveView("stage4")}
              className={`btn ${activeView === "stage4" ? "btn-crimson" : "btn-ghost"}`}
              style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            >
              4. EXTRACTION
            </button>
          </nav>
        )}

        {/* Live Metrics & Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {role === "team" && team && (
            <>
              {/* Money Badge */}
              <div className="badge badge-gold font-mono" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                <span>💰</span>
                <span>€{(team.money || 0).toLocaleString()}</span>
              </div>

              {/* Risk Badge */}
              <div className="badge badge-crimson font-mono" style={{ fontSize: "0.85rem", padding: "6px 12px" }}>
                <span>🔥</span>
                <span>{(team.risk || 0).toFixed(1)} RISK</span>
              </div>

              {/* Black Market Trigger */}
              <button
                onClick={onOpenMarket}
                className="btn btn-outline-gold"
                style={{ fontSize: "0.75rem", padding: "6px 14px", position: "relative" }}
              >
                <span>🛒</span> BLACK MARKET
                <span style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--gold)",
                  boxShadow: "0 0 8px var(--gold)"
                }} />
              </button>

              {/* Hints Button */}
              <button
                onClick={onOpenHints}
                className="btn btn-ghost"
                style={{ fontSize: "0.75rem", padding: "6px 12px" }}
              >
                <span>💡</span> INTEL
              </button>

              {/* Team Pill */}
              <div style={{
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "6px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end"
              }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>
                  {team.code}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                  {team.name}
                </span>
              </div>
            </>
          )}

          {role === "admin" && (
            <div className="badge badge-crimson" style={{ padding: "6px 12px" }}>
              ORGANIZER COMMAND ACTIVE
            </div>
          )}

          <button
            onClick={onLogout}
            className="btn btn-ghost"
            style={{ fontSize: "0.75rem", padding: "6px 12px" }}
            title="Sign out of console"
          >
            LOGOUT
          </button>
        </div>
      </div>
    </header>
  );
}
