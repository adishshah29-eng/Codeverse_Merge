import React, { useState, useEffect } from "react";
import { X, Trophy, RefreshCw, Medal } from "lucide-react";
import { leaderboardApi } from "../api";

const STAGE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function LeaderboardModal({ isOpen, onClose, currentTeamId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [enabled, setEnabled] = useState(STAGE_IDS);
  const [maxTotal, setMaxTotal] = useState(100);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await leaderboardApi.getLeaderboard();
      setLeaderboard(res.leaderboard || []);
      if (res.enabled_stages) setEnabled(res.enabled_stages);
      if (res.max_total_score) setMaxTotal(res.max_total_score);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
      const interval = setInterval(fetchLeaderboard, 8000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-rise">
      <div className="relative w-full max-w-4xl glass-panel-glow rounded-2xl border border-[#352D27] overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#352D27] bg-[#161210]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans uppercase tracking-wider">
                Phase 1 Leaderboard — Heist + Arena
              </h2>
              <p className="text-xs text-gray-400 font-sans">
                Live Server Rankings // Auto-refreshes every 8s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161210] transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#E9DFCB]" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161210] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-[#161210] rounded-xl border border-[#352D27] overflow-hidden">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#161210] text-gray-400 border-b border-[#352D27]">
                <tr>
                  <th className="py-3 px-3.5 text-center w-16">Rank</th>
                  <th className="py-3 px-3.5">Team Operative</th>
                  <th className="py-3 px-3.5 text-center">Stage</th>
                  {STAGE_IDS.map((n) => (
                    <th key={n} className={`py-3 px-1.5 text-center ${enabled.includes(n) ? "" : "opacity-40 line-through"}`} title={enabled.includes(n) ? "" : "Switched off — not counted"}>G{n}</th>
                  ))}
                  <th className="py-3 px-3.5 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#352D27]">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="14" className="py-8 text-center text-gray-500 font-sans">
                      No active operatives registered yet.
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((entry) => {
                    const isCurrent = entry.team_id === currentTeamId;
                    let rankBadge = <span className="font-bold text-gray-400">#{entry.rank}</span>;
                    if (entry.rank === 1) {
                      rankBadge = (
                        <span className="flex items-center justify-center gap-0.5 text-amber-400 font-extrabold">
                          <Medal className="w-4 h-4" /> 1
                        </span>
                      );
                    } else if (entry.rank === 2) {
                      rankBadge = (
                        <span className="flex items-center justify-center gap-0.5 text-slate-300 font-extrabold">
                          <Medal className="w-4 h-4" /> 2
                        </span>
                      );
                    } else if (entry.rank === 3) {
                      rankBadge = (
                        <span className="flex items-center justify-center gap-0.5 text-amber-700 font-extrabold">
                          <Medal className="w-4 h-4" /> 3
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={entry.team_id}
                        className={`transition ${
                          isCurrent ? "bg-[#D2362B]/15 font-semibold text-white border-l-4 border-l-[#D2362B]" : "hover:bg-[#161210]/60"
                        }`}
                      >
                        <td className="py-3 px-3.5 text-center">{rankBadge}</td>
                        <td className="py-3 px-3.5 font-bold">
                          <span className={isCurrent ? "text-[#D2362B]" : "text-white"}>
                            {entry.team_name}
                          </span>
                          {isCurrent && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-[#D2362B]/20 text-[#E9DFCB] border border-[#D2362B]/40 uppercase">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded bg-[#161210] border border-[#352D27] text-gray-300">
                            {entry.current_stage > 10 ? "DONE" : `G${entry.current_stage}`}
                          </span>
                        </td>
                        {STAGE_IDS.map((n) => (
                          <td key={n} className={`py-3 px-1.5 text-center text-gray-300 ${enabled.includes(n) ? "" : "opacity-30"}`}>
                            {entry.stage_scores?.[`stage_${n}`] ? `+${entry.stage_scores[`stage_${n}`].toFixed(1)}` : "—"}
                          </td>
                        ))}
                        <td className="py-3 px-3.5 text-right font-bold text-sm text-[#E9DFCB]">
                          {entry.total_score.toFixed(2)}
                          <span className="text-[10px] text-gray-500 font-normal ml-1">/ {maxTotal}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#352D27] bg-[#161210] flex items-center justify-between text-xs font-sans text-gray-400">
          <span>Synced with FastAPI Server | Last updated: {lastUpdated || "now"}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#161210] hover:bg-[#1F1A17] text-gray-200 border border-[#352D27]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
