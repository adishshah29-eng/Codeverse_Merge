import React, { useState, useEffect, useCallback, useRef } from "react";
import Header from "./components/Header";
import TeamDashboardModal from "./components/TeamDashboardModal";
import LeaderboardModal from "./components/LeaderboardModal";
import AdminPortal from "./components/AdminPortal";

import Game1VaultBreach from "./games/Game1VaultBreach";
import Game2AlarmSystem from "./games/Game2AlarmSystem";
import Game3HiddenBlueprint from "./games/Game3HiddenBlueprint";
import Game4MintMap from "./games/Game4MintMap";
import Game5PrintingPress from "./games/Game5PrintingPress";
import ChallengeStage from "./games/ChallengeStage";
import StageOverview from "./components/StageOverview";

// Stages 1-5: Royal Mint Heist (original games). Stages 6-10: Challenge Arena (generic challenge screen).
const TOTAL_STAGES = 10;
const LEGACY_GAMES = {
  1: Game1VaultBreach,
  2: Game2AlarmSystem,
  3: Game3HiddenBlueprint,
  4: Game4MintMap,
  5: Game5PrintingPress,
};

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
  const firstLoad = useRef(true);

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
      if (data.current_stage <= TOTAL_STAGES) {
        // On the first load open the team's current stage (not stage 1, which may be finished).
        const isFirst = firstLoad.current;
        firstLoad.current = false;
        setActiveStageId((prev) => {
          if (isFirst) return data.current_stage;
          // If active stage is already manually set to an unlocked one, keep it; else set current
          const targetObj = data.stages.find((s) => s.stage_id === prev);
          if (targetObj && targetObj.enabled !== false && (targetObj.status !== "LOCKED" || data.unlock_all)) return prev;
          return data.current_stage;
        });
      } else {
        setActiveStageId(TOTAL_STAGES);
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

  const isMissionComplete = dashboard?.current_stage > TOTAL_STAGES;

  return (
    <div className="min-h-screen bg-[#0D0B0A] text-beige flex flex-col font-sans">
      
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
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-sans text-sm text-[#E9DFCB]">
            <p>{phaseError}</p>
            <a href="/" className="underline text-gray-300 hover:text-white">Back to mission hub</a>
          </div>
        ) : isAdmin ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-sans text-sm text-[#E9DFCB]">
            <p>Organizer session active.</p>
            <button onClick={() => setIsAdminOpen(true)} className="underline text-gray-300 hover:text-white">Open Phase 1 admin portal</button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 font-sans text-sm text-[#E9DFCB]">
            <div className="w-12 h-12 rounded-full border-2 border-[#D2362B] border-t-transparent animate-spin" />
            <p>Syncing with the Challenge Arena...</p>
          </div>
        ) : isMissionComplete ? (
          /* Mission Complete Victory Screen */
          <div className="glass-panel-glow p-8 sm:p-12 rounded-3xl border-2 border-[#D2362B]/40 text-center max-w-3xl mx-auto space-y-6 animate-rise">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-red p-1 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-ink" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-sans text-[#E9DFCB] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-[#D2362B]/20 border border-[#D2362B]/30">
                ALL TEN STAGES COMPLETE
              </span>
              <h2 className="text-3xl sm:text-4xl font-display font-semibold text-white tracking-tight">
                Phase 1 Complete
              </h2>
              <p className="text-sm text-gray-300 font-sans max-w-lg mx-auto">
                Operative team <strong className="text-[#E9DFCB]">{team?.name}</strong> has completed the Royal Mint Heist and all five Challenge Arena problems.
              </p>
            </div>

            {/* Scorecard */}
            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto py-2 font-sans">
              <div className="p-3.5 rounded-2xl bg-[#161210] border border-[#352D27]">
                <div className="text-[10px] text-gray-400 uppercase">Final Score</div>
                <div className="text-2xl font-bold text-[#E9DFCB] mt-0.5">
                  {dashboard?.total_score.toFixed(2)}
                </div>
                <div className="text-[10px] text-gray-500">out of {Number(dashboard?.max_total_score ?? 100).toFixed(1)} pts</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#161210] border border-[#352D27]">
                <div className="text-[10px] text-gray-400 uppercase">Rank</div>
                <div className="text-2xl font-bold text-amber-400 mt-0.5">
                  #{dashboard?.rank || 1}
                </div>
                <div className="text-[10px] text-gray-500">Overall Board</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#161210] border border-[#352D27]">
                <div className="text-[10px] text-gray-400 uppercase">Penalties</div>
                <div className="text-2xl font-bold text-rose-400 mt-0.5">
                  -{dashboard?.total_penalty.toFixed(1)}
                </div>
                <div className="text-[10px] text-gray-500">deductions</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-red text-white font-sans font-bold text-xs uppercase tracking-wider transition"
              >
                Inspect Official Leaderboard &rarr;
              </button>
            </div>
          </div>
        ) : (
          /* All games, then the active stage */
          <>
          {dashboard?.debug_unlock_all && (
            <p className="mb-4 border-l-4 border-red bg-red-deep px-3 py-2 text-sm text-red-text">
              <strong>Debug mode:</strong> every game is unlocked and replayable. Progress and scores are still recorded.
            </p>
          )}
          <StageOverview dashboard={dashboard} activeStageId={activeStageId} onSelectStage={handleStageSelect} />
          {(() => {
            const onDone = (nextStage) => {
              fetchDashboard();
              if (nextStage) setActiveStageId(nextStage);
            };
            const Legacy = LEGACY_GAMES[activeStageId];
            return Legacy ? (
              <Legacy key={activeStageId} onStageComplete={onDone} dashboard={dashboard} onRefresh={fetchDashboard} />
            ) : (
              <ChallengeStage key={activeStageId} stageId={activeStageId} dashboard={dashboard} onRefresh={fetchDashboard} onStageComplete={onDone} />
            );
          })()}
          </>
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
      <footer className="border-t border-[#352D27] py-3 px-6 text-center text-xs font-sans text-gray-500">
        CODEVERSE 2.0 &bull; Phase 1: Royal Mint Heist + Challenge Arena &bull; FastAPI + React.js + SQLite
      </footer>

    </div>
  );
}
