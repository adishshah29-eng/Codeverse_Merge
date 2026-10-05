import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import TeamDashboardModal from "./components/TeamDashboardModal";
import LeaderboardModal from "./components/LeaderboardModal";
import AdminPortal from "./components/AdminPortal";

import Game1VaultBreach from "./games/Game1VaultBreach";
import Game2AlarmSystem from "./games/Game2AlarmSystem";
import Game3HiddenBlueprint from "./games/Game3HiddenBlueprint";
import Game4MintMap from "./games/Game4MintMap";
import Game5PrintingPress from "./games/Game5PrintingPress";

import { authApi, progressApi } from "./api";
import { Trophy, CheckCircle2, ShieldCheck, Flame, ArrowRight } from "lucide-react";

export default function App() {
  const [team, setTeam] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [activeStageId, setActiveStageId] = useState(1);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phaseError, setPhaseError] = useState("");

  const [isAdmin, setIsAdmin] = useState(false);

  // Initialize session from the shared platform login (httpOnly cookie).
  useEffect(() => {
    authApi.me()
      .then((session) => {
        if (!session.authenticated) {
          window.location.assign("/");
          return;
        }
        if (session.role === "admin") {
          setIsAdmin(true);
          setIsAdminOpen(true);
          setLoading(false);
          return;
        }
        setTeam({ id: null, name: session.team?.name });
        fetchDashboard();
      })
      .catch((err) => {
        console.error("Session check failed:", err);
        window.location.assign("/");
      });
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await progressApi.getDashboard();
      setDashboard(data);
      setTeam({ id: data.team_id, name: data.team_name });
      // Auto-set to current active stage if valid
      if (data.current_stage <= 5) {
        setActiveStageId((prev) => {
          // If active stage is already manually set to an unlocked one, keep it; else set current
          const targetObj = data.stages.find((s) => s.stage_id === prev);
          if (targetObj && targetObj.status !== "LOCKED") return prev;
          return data.current_stage;
        });
      } else {
        setActiveStageId(5);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      // Session expired: return to the shared login page
      if (err.status === 401) {
        window.location.assign("/");
      } else if (err.status === 403) {
        setPhaseError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } finally {
      window.location.assign("/");
    }
  };

  const handleStageSelect = (stageId) => {
    setActiveStageId(stageId);
  };

  const isMissionComplete = dashboard?.current_stage > 5;

  return (
    <div className="min-h-screen bg-[#07090e] text-gray-100 flex flex-col font-['Inter',sans-serif]">
      
      {/* Persistent HUD Navigation */}
      <Header
        team={team}
        dashboard={dashboard}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        onOpenLeaderboard={() => setIsLeaderboardOpen(true)}
        onOpenAdmin={isAdmin ? () => setIsAdminOpen(true) : null}
        onLogout={handleLogout}
        onSelectStage={handleStageSelect}
        activeStageId={activeStageId}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {phaseError ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-sm text-[#d4af37]">
            <p>{phaseError}</p>
            <a href="/" className="underline text-gray-300 hover:text-white">Back to mission hub</a>
          </div>
        ) : isAdmin ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-sm text-[#d4af37]">
            <p>Organizer session active.</p>
            <button onClick={() => setIsAdminOpen(true)} className="underline text-gray-300 hover:text-white">Open Phase 1 admin portal</button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-mono text-sm text-[#d4af37]">
            <div className="w-12 h-12 rounded-full border-2 border-[#d4af37] border-t-transparent animate-spin" />
            <p>Syncing with Royal Mint Security Kernel...</p>
          </div>
        ) : isMissionComplete ? (
          /* Mission Complete Victory Screen */
          <div className="glass-panel-glow p-8 sm:p-12 rounded-3xl border-2 border-[#d4af37]/40 text-center max-w-3xl mx-auto space-y-6 animate-fadeIn">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-[#d4af37] to-[#8c701b] p-1 shadow-2xl shadow-[#d4af37]/30 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-black" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono text-[#d4af37] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/30">
                OPERATION ACCOMPLISHED // EL PLAN FINALIZADO
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                Heist Mastermind Status Achieved
              </h2>
              <p className="text-sm text-gray-300 font-mono max-w-lg mx-auto">
                Operative team <strong className="text-[#d4af37]">{team?.name}</strong> has successfully completed all 5 stages of the Royal Mint Infiltration Challenge!
              </p>
            </div>

            {/* Scorecard */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-2 font-mono">
              <div className="p-3.5 rounded-2xl bg-[#111726] border border-[#23304d]">
                <div className="text-[10px] text-gray-400 uppercase">Final Score</div>
                <div className="text-2xl font-black text-[#d4af37] mt-0.5">
                  {dashboard?.total_score.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500">out of 50.0 pts</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#111726] border border-[#23304d]">
                <div className="text-[10px] text-gray-400 uppercase">Rank</div>
                <div className="text-2xl font-black text-amber-400 mt-0.5">
                  #{dashboard?.rank || 1}
                </div>
                <div className="text-[10px] text-gray-500">Overall Board</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#111726] border border-[#23304d]">
                <div className="text-[10px] text-gray-400 uppercase">Penalties</div>
                <div className="text-2xl font-black text-rose-400 mt-0.5">
                  -{dashboard?.total_penalty.toFixed(1)}
                </div>
                <div className="text-[10px] text-gray-500">deductions</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89628] hover:from-[#e5bd3d] text-black font-mono font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#d4af37]/20 transition"
              >
                Inspect Official Leaderboard &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* Render Active Game Canvas */
          <div>
            {activeStageId === 1 && (
              <Game1VaultBreach
                onStageComplete={(nextStage) => {
                  fetchDashboard();
                  setActiveStageId(nextStage);
                }}
                dashboard={dashboard}
                onRefresh={fetchDashboard}
              />
            )}

            {activeStageId === 2 && (
              <Game2AlarmSystem
                onStageComplete={(nextStage) => {
                  fetchDashboard();
                  setActiveStageId(nextStage);
                }}
                dashboard={dashboard}
                onRefresh={fetchDashboard}
              />
            )}

            {activeStageId === 3 && (
              <Game3HiddenBlueprint
                onStageComplete={(nextStage) => {
                  fetchDashboard();
                  setActiveStageId(nextStage);
                }}
                dashboard={dashboard}
                onRefresh={fetchDashboard}
              />
            )}

            {activeStageId === 4 && (
              <Game4MintMap
                onStageComplete={(nextStage) => {
                  fetchDashboard();
                  setActiveStageId(nextStage);
                }}
                dashboard={dashboard}
                onRefresh={fetchDashboard}
              />
            )}

            {activeStageId === 5 && (
              <Game5PrintingPress
                onStageComplete={() => {
                  fetchDashboard();
                }}
                dashboard={dashboard}
                onRefresh={fetchDashboard}
              />
            )}
          </div>
        )}

      </main>

      {/* Modals & Overlays */}
      <TeamDashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        dashboard={dashboard}
        onRefresh={fetchDashboard}
        onStageChange={(newStage) => setActiveStageId(newStage)}
      />

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        currentTeamId={team?.id}
      />

      <AdminPortal
        isOpen={isAdminOpen}
        onClose={() => (isAdmin ? window.location.assign("/") : setIsAdminOpen(false))}
      />

      {/* Footer */}
      <footer className="border-t border-[#23304d] py-3 px-6 text-center text-xs font-mono text-gray-500">
        CODEVERSE 2.0 &bull; Royal Mint Heist Unified Challenge Platform &bull; FastAPI + React.js + SQLite
      </footer>

    </div>
  );
}
