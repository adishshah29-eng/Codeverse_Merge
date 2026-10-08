import React, { useState } from "react";
import { 
  X, CheckCircle, FastForward, Lock, AlertTriangle, 
  HelpCircle, Flame, Shield, Timer as TimerIcon, Trophy
} from "lucide-react";
import { progressApi } from "../api";

export default function TeamDashboardModal({
  isOpen,
  onClose,
  dashboard,
  onRefresh,
  onStageChange
}) {
  const [skipLoading, setSkipLoading] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !dashboard) return null;

  const currentStageId = dashboard.current_stage;
  const currentStageObj = dashboard.stages.find((s) => s.stage_id === currentStageId);
  const isMissionComplete = currentStageId > 10;

  const handleSkipStage = async () => {
    if (!currentStageId || currentStageId > 10) return;
    setSkipLoading(true);
    setErrorMsg("");
    try {
      await progressApi.skipStage(currentStageId);
      setShowSkipConfirm(false);
      await onRefresh();
      onStageChange(Math.min(10, currentStageId + 1));
    } catch (err) {
      setErrorMsg(err.message || "Failed to skip stage.");
    } finally {
      setSkipLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-rise">
      <div className="relative w-full max-w-3xl glass-panel-glow rounded-2xl border border-[#352D27] overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#352D27] bg-[#161210]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D2362B]/20 border border-[#D2362B]/40 flex items-center justify-center text-[#E9DFCB]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-sans uppercase tracking-wider">
                Operative Mission Dashboard
              </h2>
              <p className="text-xs text-gray-400 font-sans">
                Team: <span className="text-[#E9DFCB] font-semibold">{dashboard.team_name}</span> | Tournament Rank: #{dashboard.rank || 1}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#161210] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs font-sans">
              {errorMsg}
            </div>
          )}

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#161210] p-3.5 rounded-xl border border-[#352D27]">
              <div className="text-[11px] text-gray-400 font-sans uppercase">Total Points</div>
              <div className="text-xl font-bold text-[#E9DFCB] font-sans mt-0.5">
                {dashboard.total_score.toFixed(2)} <span className="text-xs text-gray-500">/ 100.0</span>
              </div>
            </div>

            <div className="bg-[#161210] p-3.5 rounded-xl border border-[#352D27]">
              <div className="text-[11px] text-gray-400 font-sans uppercase">Mission Status</div>
              <div className="text-sm font-bold text-white font-sans mt-1">
                {isMissionComplete ? (
                  <span className="text-emerald-400 flex items-center gap-1">Complete</span>
                ) : (
                  <span className="text-[#E9DFCB]">Stage {currentStageId} Active</span>
                )}
              </div>
            </div>

            <div className="bg-[#161210] p-3.5 rounded-xl border border-[#352D27]">
              <div className="text-[11px] text-gray-400 font-sans uppercase">Total Penalties</div>
              <div className="text-lg font-bold text-rose-400 font-sans mt-0.5 flex items-center gap-1">
                <Flame className="w-4 h-4 text-rose-500" />
                -{dashboard.total_penalty.toFixed(1)} pts
              </div>
            </div>

            <div className="bg-[#161210] p-3.5 rounded-xl border border-[#352D27]">
              <div className="text-[11px] text-gray-400 font-sans uppercase">Leaderboard Position</div>
              <div className="text-lg font-bold text-amber-400 font-sans mt-0.5 flex items-center gap-1">
                <Trophy className="w-4 h-4 text-amber-500" />
                Rank #{dashboard.rank || 1}
              </div>
            </div>
          </div>

          {/* Stages Breakdown Table */}
          <div>
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-sans mb-3">
              Progression Matrix (Strict Order: stages 1 &rarr; 10)
            </h3>
            <div className="bg-[#161210] rounded-xl border border-[#352D27] overflow-hidden">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#161210] text-gray-400 border-b border-[#352D27]">
                  <tr>
                    <th className="py-2.5 px-3">Stage</th>
                    <th className="py-2.5 px-3">Challenge Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Score</th>
                    <th className="py-2.5 px-3 text-right">Actions / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#352D27]">
                  {dashboard.stages.map((st) => {
                    const isCur = (currentStageId === st.stage_id);
                    return (
                      <tr 
                        key={st.stage_id}
                        className={`transition hover:bg-[#161210]/50 ${isCur ? "bg-[#D2362B]/5" : ""}`}
                      >
                        <td className="py-2.5 px-3 font-bold text-white">G{st.stage_id}</td>
                        <td className="py-2.5 px-3 font-medium text-gray-200">{st.stage_name}</td>
                        <td className="py-2.5 px-3">
                          {st.status === "COMPLETED" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-fit">
                              <CheckCircle className="w-3 h-3" /> COMPLETED
                            </span>
                          )}
                          {st.status === "SKIPPED" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
                              <FastForward className="w-3 h-3" /> SKIPPED
                            </span>
                          )}
                          {st.status === "ACTIVE" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#D2362B]/20 text-[#E9DFCB] border border-[#D2362B]/40 flex items-center gap-1 w-fit">
                              ACTIVE NOW
                            </span>
                          )}
                          {st.status === "LOCKED" && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#161210] text-gray-500 border border-gray-700/50 flex items-center gap-1 w-fit">
                              <Lock className="w-3 h-3" /> LOCKED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          {st.score > 0 ? (
                            <span className="text-emerald-400">+{st.score.toFixed(2)} pts</span>
                          ) : (
                            <span className="text-gray-500">0.00 pts</span>
                          )}
                          <span className="text-[10px] text-gray-500 block font-normal">Max: 10.0</span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              onStageChange(st.stage_id);
                              onClose();
                            }}
                            disabled={st.status === "LOCKED" && !isCur}
                            className={`px-2.5 py-1 rounded text-[11px] font-sans border transition ${
                              st.status === "LOCKED" 
                                ? "border-gray-800 text-gray-600 cursor-not-allowed" 
                                : "border-[#352D27] bg-[#161210] text-gray-200 hover:border-[#D2362B]"
                            }`}
                          >
                            {isCur ? "Play Now" : "View"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Skip Game Action Section */}
          {!isMissionComplete && currentStageObj && currentStageObj.status === "ACTIVE" && (
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase font-sans">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Stuck on Stage {currentStageId}? (Game Skip Option)
                </div>
                <p className="text-xs text-gray-400 font-sans mt-0.5">
                  You can permanently skip this challenge to unlock the next stage. Skipping yields 0 points for this game.
                </p>
              </div>

              {!showSkipConfirm ? (
                <button
                  onClick={() => setShowSkipConfirm(true)}
                  className="px-4 py-2 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-600/50 text-rose-200 text-xs font-sans font-bold whitespace-nowrap transition"
                >
                  Skip Current Game &rarr;
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSkipStage}
                    disabled={skipLoading}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-sans font-bold transition flex items-center gap-1"
                  >
                    {skipLoading ? "Skipping..." : "Confirm Permanent Skip"}
                  </button>
                  <button
                    onClick={() => setShowSkipConfirm(false)}
                    className="px-3 py-1.5 rounded-lg bg-[#161210] hover:bg-[#1F1A17] border border-[#352D27] text-gray-300 text-xs font-sans"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#352D27] bg-[#161210] flex items-center justify-between text-xs font-sans text-gray-400">
          <span>Max score for any single game is strictly capped at 10.0 points.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#161210] hover:bg-[#1F1A17] text-gray-200 border border-[#352D27] font-bold"
          >
            Close Dashboard
          </button>
        </div>

      </div>
    </div>
  );
}
