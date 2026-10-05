import React, { useState, useEffect } from "react";
import { X, Trophy, RefreshCw, Medal } from "lucide-react";
import { leaderboardApi } from "../api";

export default function LeaderboardModal({ isOpen, onClose, currentTeamId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await leaderboardApi.getLeaderboard();
      setLeaderboard(res.leaderboard || []);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl glass-panel-glow rounded-2xl border border-[#23304d] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#23304d] bg-[#111726]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider">
                Royal Mint Tournament Leaderboard
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Live Server Rankings // Auto-refreshes every 8s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161f33] transition"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#d4af37]" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161f33] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-[#111726] rounded-xl border border-[#23304d] overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#161f33] text-gray-400 border-b border-[#23304d]">
                <tr>
                  <th className="py-3 px-3.5 text-center w-16">Rank</th>
                  <th className="py-3 px-3.5">Team Operative</th>
                  <th className="py-3 px-3.5 text-center">Stage</th>
                  <th className="py-3 px-2 text-center">G1</th>
                  <th className="py-3 px-2 text-center">G2</th>
                  <th className="py-3 px-2 text-center">G3</th>
                  <th className="py-3 px-2 text-center">G4</th>
                  <th className="py-3 px-2 text-center">G5</th>
                  <th className="py-3 px-3.5 text-right">Total Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#23304d]">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-gray-500 font-mono">
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
                          isCurrent ? "bg-[#d4af37]/15 font-semibold text-white border-l-4 border-l-[#d4af37]" : "hover:bg-[#161f33]/60"
                        }`}
                      >
                        <td className="py-3 px-3.5 text-center">{rankBadge}</td>
                        <td className="py-3 px-3.5 font-bold">
                          <span className={isCurrent ? "text-[#d4af37]" : "text-white"}>
                            {entry.team_name}
                          </span>
                          {isCurrent && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.2 rounded bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/40 uppercase">
                              YOU
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <span className="px-2 py-0.5 rounded bg-[#161f33] border border-[#23304d] text-gray-300">
                            {entry.current_stage > 5 ? "DONE" : `G${entry.current_stage}`}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-gray-300">
                          {entry.stage_scores?.stage_1 ? `+${entry.stage_scores.stage_1.toFixed(1)}` : "—"}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-300">
                          {entry.stage_scores?.stage_2 ? `+${entry.stage_scores.stage_2.toFixed(1)}` : "—"}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-300">
                          {entry.stage_scores?.stage_3 ? `+${entry.stage_scores.stage_3.toFixed(1)}` : "—"}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-300">
                          {entry.stage_scores?.stage_4 ? `+${entry.stage_scores.stage_4.toFixed(1)}` : "—"}
                        </td>
                        <td className="py-3 px-2 text-center text-gray-300">
                          {entry.stage_scores?.stage_5 ? `+${entry.stage_scores.stage_5.toFixed(1)}` : "—"}
                        </td>
                        <td className="py-3 px-3.5 text-right font-black text-sm text-[#d4af37]">
                          {entry.total_score.toFixed(2)}
                          <span className="text-[10px] text-gray-500 font-normal ml-1">pts</span>
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
        <div className="px-6 py-3 border-t border-[#23304d] bg-[#111726] flex items-center justify-between text-xs font-mono text-gray-400">
          <span>Synced with FastAPI Server | Last updated: {lastUpdated || "now"}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] text-gray-200 border border-[#23304d]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
