import React, { useState, useEffect } from "react";
import { api } from "../api";

export default function BlackMarketModal({ isOpen, onClose, onFundsUpdated }) {
  const [activeTab, setActiveTab] = useState("catalog"); // "catalog" or "torch_puzzle"
  const [catalog, setCatalog] = useState(null);
  const [teamMoney, setTeamMoney] = useState(0);
  const [teamPurchases, setTeamPurchases] = useState(0);
  const [category, setCategory] = useState("hints");
  const [purchasingId, setPurchasingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadMarket = async () => {
    try {
      const res = await api.getMarketCatalog();
      setCatalog(res.catalog || {});
      setTeamMoney(res.team_money || 0);
      setTeamPurchases(res.team_purchases || 0);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMarket();
    }
  }, [isOpen]);

  const handleBuy = async (cat, itemId) => {
    setPurchasingId(itemId);
    setMessage("");
    setError("");
    try {
      const res = await api.purchaseMarketItem(cat, itemId);
      setMessage(res.message);
      setTeamMoney(res.new_balance);
      setTeamPurchases(res.team_purchases);
      await loadMarket();
      if (onFundsUpdated) onFundsUpdated(res.new_balance);
    } catch (err) {
      setError(err.message);
    } finally {
      setPurchasingId(null);
    }
  };

  if (!isOpen) return null;

  const currentCategoryItems = catalog ? catalog[category] || [] : [];
  const inflationPercentage = teamPurchases * 25;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(12px)",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }}>
      <div className="glass-panel" style={{
        maxWidth: 1000,
        width: "100%",
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        border: "1px solid var(--border-gold)",
        boxShadow: "0 0 40px rgba(245, 158, 11, 0.2)"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 28px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "1.6rem" }}>🛒</span>
              <div>
                <h3 style={{ fontSize: "1.3rem", fontFamily: "var(--font-display)", color: "#fff" }}>
                  THE BLACK MARKET // PARALLEL SHADOW ECONOMY
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  Strategic Heist Assets // Isolated Team Price Inflation (+25% per team purchase)
                </span>
              </div>
            </div>
          </div>

          {/* Wallet and Inflation Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="badge badge-gold font-mono" style={{ fontSize: "0.95rem", padding: "6px 14px" }}>
              <span>💰 FUNDS:</span>
              <span>€{teamMoney.toLocaleString()}</span>
            </div>

            <div className="badge badge-crimson font-mono" style={{ fontSize: "0.8rem", padding: "6px 12px" }}>
              <span>INFLATION:</span>
              <span>+{inflationPercentage}%</span>
            </div>

            <button onClick={onClose} className="btn btn-ghost" style={{ padding: "6px 12px" }}>
              ✕
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          padding: "0 28px",
          background: "rgba(0,0,0,0.2)"
        }}>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`btn ${activeTab === "catalog" ? "btn-gold" : "btn-ghost"}`}
            style={{ borderRadius: 0, borderBottom: activeTab === "catalog" ? "2px solid #fff" : "none", fontSize: "0.8rem" }}
          >
            📦 ASSET CATALOG & INTEL
          </button>
          <button
            onClick={() => setActiveTab("torch_puzzle")}
            className={`btn ${activeTab === "torch_puzzle" ? "btn-gold" : "btn-ghost"}`}
            style={{ borderRadius: 0, borderBottom: activeTab === "torch_puzzle" ? "2px solid #fff" : "none", fontSize: "0.8rem" }}
          >
            🔦 CURSOR TORCH RECONNAISSANCE
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: 28, flex: 1, overflowY: "auto" }}>
          {error && (
            <div style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "#fca5a5",
              padding: "10px 16px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 16,
              fontSize: "0.85rem"
            }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{
              background: "rgba(16, 185, 129, 0.15)",
              color: "#a7f3d0",
              padding: "10px 16px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 16,
              fontSize: "0.85rem"
            }}>
              {message}
            </div>
          )}

          {activeTab === "catalog" && (
            <div>
              {/* Category Filter Buttons */}
              <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
                {["hints", "buffs", "mystery"].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`btn ${category === cat ? "btn-crimson" : "btn-ghost"}`}
                    style={{ fontSize: "0.75rem", padding: "6px 16px" }}
                  >
                    {cat === "hints" && "💡 SECTOR INTEL"}
                    {cat === "buffs" && "🛡️ TACTICAL BUFFS"}
                    {cat === "mystery" && "❓ CONTRABAND CACHES"}
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16
              }}>
                {currentCategoryItems.map((item) => {
                  const isMaxed = item.is_maxed;
                  const canAfford = teamMoney >= item.current_price;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--bg-surface-elevated)",
                        border: `1px solid ${isMaxed ? "rgba(16, 185, 129, 0.4)" : "var(--border-subtle)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <h4 style={{ fontSize: "0.95rem", color: "#fff", fontWeight: 700 }}>
                            {item.name}
                          </h4>
                          <span className="badge badge-gold font-mono" style={{ fontSize: "0.75rem" }}>
                            €{item.current_price.toLocaleString()}
                          </span>
                        </div>

                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
                          {item.description}
                        </p>

                        {item.intel && item.times_bought > 0 && (
                          <div style={{
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid rgba(245, 158, 11, 0.3)",
                            borderRadius: "var(--radius-sm)",
                            padding: 10,
                            fontSize: "0.8rem",
                            color: "#fde68a",
                            marginBottom: 14,
                            fontFamily: "var(--font-mono)"
                          }}>
                            ✓ INTEL: {item.intel}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleBuy(category, item.id)}
                        disabled={isMaxed || !canAfford || purchasingId === item.id}
                        className={`btn ${isMaxed ? "btn-ghost" : canAfford ? "btn-gold" : "btn-ghost"}`}
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      >
                        {isMaxed
                          ? "✓ ASSET ACQUIRED"
                          : purchasingId === item.id
                          ? "PROCESSING..."
                          : !canAfford
                          ? "INSUFFICIENT FUNDS"
                          : `ACQUIRE ASSET (€${item.current_price.toLocaleString()})`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "torch_puzzle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{
                background: "rgba(0,0,0,0.4)",
                padding: 14,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-subtle)"
              }}>
                <h4 style={{ color: "#fff", fontSize: "0.9rem", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                  ENVIRONMENTAL INVESTIGATION RECON
                </h4>
                <p style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                  Launch the full interactive Cursor-Torch investigation interface with audio and flashlight mechanics.
                </p>
              </div>

              <div style={{ height: 480, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <iframe
                  src="/vendor/market/index.html"
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="Cursor Torch Investigation"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
