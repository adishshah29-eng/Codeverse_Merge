import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, RefreshCw, X, RotateCcw, UserX, UserCheck, 
  Trash2, Sliders, History, AlertCircle
} from "lucide-react";
import { adminApi } from "../api";

export default function AdminPortal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState("teams");
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [configJson, setConfigJson] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const [actionMsg, setActionMsg] = useState("");

  const loadData = async () => {
    setLoading(true);
    setActionMsg("");
    try {
      if (activeTab === "teams") {
        const res = await adminApi.getTeams();
        setTeams(res.teams || []);
      } else if (activeTab === "config") {
        const res = await adminApi.getConfig();
        setConfig(res.scoring_config);
        setConfigJson(JSON.stringify(res.scoring_config, null, 2));
      } else if (activeTab === "logs") {
        const res = await adminApi.getAuditLogs();
        setAuditLogs(res.logs || []);
      }
    } catch (err) {
      console.error("Admin error:", err);
      setActionMsg(err.message || "Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleResetTeam = async (teamId, targetStage = 1) => {
    if (!window.confirm(`Are you sure you want to reset this team to Stage ${targetStage}?`)) return;
    try {
      await adminApi.updateTeam(teamId, { reset_stage: targetStage });
      setActionMsg(`Team reset to Stage ${targetStage} successfully.`);
      loadData();
    } catch (err) {
      setActionMsg(err.message || "Failed to reset team.");
    }
  };

  const handleToggleActive = async (teamId, currentActive) => {
    try {
      await adminApi.updateTeam(teamId, { is_active: !currentActive });
      loadData();
    } catch (err) {
      setActionMsg(err.message || "Failed to update team status.");
    }
  };

  const handleDeleteTeam = async (teamId, teamName) => {
    if (!window.confirm(`Delete all Phase 1 progress for "${teamName}"? Their login is kept; this cannot be undone.`)) return;
    try {
      await adminApi.deleteTeam(teamId);
      setActionMsg(`Phase 1 progress for "${teamName}" deleted.`);
      loadData();
    } catch (err) {
      setActionMsg(err.message || "Failed to delete team.");
    }
  };

  const handleSaveConfig = async () => {
    try {
      const parsed = JSON.parse(configJson);
      await adminApi.updateConfig(parsed);
      setActionMsg("Scoring configuration updated on server.");
      loadData();
    } catch (err) {
      setActionMsg("Invalid JSON syntax: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85">
      <div className="relative w-full max-w-5xl glass-panel-glow rounded-2xl border border-rose-900/50 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-950 bg-[#2A0F0D]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans uppercase tracking-wider">
                Professor Control Room // Tournament Admin
              </h2>
              <p className="text-xs text-rose-300/80 font-sans">
                Full System Orchestration, Live Team Monitoring & Scoring Rules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161210] transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161210] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-[#161210] border-b border-[#352D27]">
          <button
            onClick={() => setActiveTab("teams")}
            className={`px-4 py-2 font-sans text-xs font-bold border-b-2 transition ${
              activeTab === "teams" 
                ? "border-rose-500 text-rose-400" 
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            Live Teams ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab("config")}
            className={`px-4 py-2 font-sans text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "config" 
                ? "border-rose-500 text-rose-400" 
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Scoring Engine Config
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 font-sans text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "logs" 
                ? "border-rose-500 text-rose-400" 
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" /> Audit Logs
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {actionMsg && (
            <div className="p-3 rounded-lg bg-[#161210] border border-[#352D27] text-xs font-sans text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionMsg}</span>
            </div>
          )}

          {activeTab === "teams" && (
            <>
              {/* Team accounts are created in the main admin dashboard (shared login) */}
              <div className="p-4 rounded-xl bg-[#161210] border border-[#352D27] text-xs font-sans text-gray-300">
                Team accounts are created once for the whole event in the{" "}
                <a href="/phase2/" className="text-[#E9DFCB] underline">main admin dashboard</a> (TEAM ACCOUNTS).
                A team appears here automatically when it first opens Phase 1.
              </div>

              {/* Teams Table */}
              <div className="bg-[#161210] rounded-xl border border-[#352D27] overflow-hidden">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-[#161210] text-gray-400 border-b border-[#352D27]">
                    <tr>
                      <th className="py-2.5 px-3">Team Name</th>
                      <th className="py-2.5 px-3">Stage</th>
                      <th className="py-2.5 px-3">Score</th>
                      <th className="py-2.5 px-3">Penalties</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#352D27]">
                    {teams.map((t) => (
                      <tr key={t.id} className="hover:bg-[#161210]/60 transition">
                        <td className="py-2.5 px-3 font-bold text-white">
                          {t.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#161210] border border-[#352D27] text-[#E9DFCB] font-bold">
                            {t.current_stage > 10 ? "FINISHED" : `Stage ${t.current_stage}`}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#E9DFCB]">
                          {t.total_score.toFixed(2)} pts
                        </td>
                        <td className="py-2.5 px-3 text-rose-400">
                          -{t.total_penalty.toFixed(1)} pts
                        </td>
                        <td className="py-2.5 px-3">
                          {t.is_active ? (
                            <span className="text-emerald-400 font-bold">Active</span>
                          ) : (
                            <span className="text-gray-500">Deactivated</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleResetTeam(t.id, 1)}
                              className="px-2 py-1 rounded bg-[#161210] hover:bg-[#1F1A17] border border-[#352D27] text-amber-400 text-[11px] flex items-center gap-1 transition"
                              title="Reset team to Stage 1"
                            >
                              <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                            <button
                              onClick={() => handleToggleActive(t.id, t.is_active)}
                              className="px-2 py-1 rounded bg-[#161210] hover:bg-[#1F1A17] border border-[#352D27] text-gray-300 text-[11px] transition"
                              title={t.is_active ? "Deactivate Team" : "Activate Team"}
                            >
                              {t.is_active ? <UserX className="w-3 h-3 text-amber-500" /> : <UserCheck className="w-3 h-3 text-emerald-400" />}
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(t.id, t.name)}
                              className="p-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/50 text-rose-400 text-[11px] transition"
                              title="Delete Team"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {activeTab === "config" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans text-gray-300">
                  Live JSON Scoring Model (All game formulas, thresholds, duration, and error brackets):
                </span>
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs font-bold transition shadow"
                >
                  Save Configuration
                </button>
              </div>
              <textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                rows={16}
                className="w-full p-4 rounded-xl bg-[#0A0807] border border-[#352D27] text-beige font-mono text-xs focus:outline-none focus:border-[#D2362B]"
              />
            </div>
          )}

          {activeTab === "logs" && (
            <div className="bg-[#161210] rounded-xl border border-[#352D27] overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#161210] text-gray-400 border-b border-[#352D27]">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Action</th>
                    <th className="py-2 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#352D27]">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#161210]/40">
                      <td className="py-2 px-3 text-gray-500">{new Date(log.created_at).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 font-bold text-white">{log.action}</td>
                      <td className="py-2 px-3 text-gray-300 max-w-md truncate">
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#352D27] bg-[#161210] flex items-center justify-between text-xs font-sans text-gray-400">
          <span>FastAPI Administrative Security Engine Active</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#161210] hover:bg-[#1F1A17] text-gray-200 border border-[#352D27]"
          >
            Close Admin
          </button>
        </div>

      </div>
    </div>
  );
}
