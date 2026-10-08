import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, Trophy, LayoutDashboard, Volume2, VolumeX, 
  Settings, LogOut, CheckCircle2, Lock, FastForward, PlayCircle
} from "lucide-react";

export default function Header({
  team,
  dashboard,
  onOpenDashboard,
  onOpenLeaderboard,
  onOpenAdmin,
  onLogout,
  onSelectStage,
  activeStageId
}) {
  const [muted, setMuted] = useState(true);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const stages = dashboard?.stages || [
    { stage_id: 1, status: "ACTIVE", score: 0 },
    { stage_id: 2, status: "LOCKED", score: 0 },
    { stage_id: 3, status: "LOCKED", score: 0 },
    { stage_id: 4, status: "LOCKED", score: 0 },
    { stage_id: 5, status: "LOCKED", score: 0 },
    { stage_id: 6, status: "LOCKED", score: 0 },
    { stage_id: 7, status: "LOCKED", score: 0 },
    { stage_id: 8, status: "LOCKED", score: 0 },
    { stage_id: 9, status: "LOCKED", score: 0 },
    { stage_id: 10, status: "LOCKED", score: 0 },
  ];

  const totalScore = dashboard?.total_score || 0;
  const rank = dashboard?.rank ? `#${dashboard.rank}` : "--";

  return (
    <header className="sticky top-0 z-50 bg-[#0c101a]/95 backdrop-blur-md border-b border-[#23304d] px-4 py-2.5 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Team Info */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d4af37] to-[#8c701b] p-0.5 shadow-lg shadow-[#d4af37]/20 flex items-center justify-center">
              <span className="font-['Impact'] text-lg text-black tracking-wider">P1</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm tracking-wide text-white font-mono uppercase whitespace-nowrap">
                  Heist &amp; Arena
                </h1>
                <span className="whitespace-nowrap text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#e50914]/20 text-[#e50914] border border-[#e50914]/30">
                  Phase 1
                </span>
              </div>
              <p className="text-xs text-gray-400 font-mono">
                Team: <span className="text-[#d4af37] font-semibold">{team?.name || "Operative"}</span>
              </p>
            </div>
          </div>

          {/* Quick HUD Score for Mobile */}
          <div className="md:hidden flex items-center gap-2 text-xs font-mono bg-[#161f33] px-2 py-1 rounded border border-[#23304d]">
            <span className="text-[#d4af37] font-bold">{totalScore.toFixed(1)}/100</span>
            <span className="text-gray-400">Rank: {rank}</span>
          </div>
        </div>

        {/* Unified 10-Stage Stepper */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 bg-[#111726]/80 px-3 py-1.5 rounded-xl border border-[#23304d] flex-wrap justify-center max-w-full">
          {stages.map((st) => {
            const isCurrent = (dashboard?.current_stage === st.stage_id);
            const isSelected = (activeStageId === st.stage_id);
            const isCompleted = (st.status === "COMPLETED");
            const isSkipped = (st.status === "SKIPPED");
            const isLocked = (st.status === "LOCKED");

            let badgeStyle = "border-[#23304d] text-gray-500 bg-[#0d121d]";
            if (isCurrent) {
              badgeStyle = "border-[#d4af37] text-white bg-[#d4af37]/20 shadow-md shadow-[#d4af37]/20 animate-pulse";
            } else if (isCompleted) {
              badgeStyle = "border-emerald-500/50 text-emerald-400 bg-emerald-950/30";
            } else if (isSkipped) {
              badgeStyle = "border-rose-500/40 text-rose-400 bg-rose-950/20 line-through";
            }

            if (isSelected && !isCurrent) {
              badgeStyle += " ring-2 ring-[#00e5ff]";
            }

            return (
              <button
                key={st.stage_id}
                onClick={() => onSelectStage(st.stage_id)}
                disabled={isLocked && !isCurrent}
                title={`Stage ${st.stage_id}: ${st.stage_name || `Game ${st.stage_id}`} (${st.status})`}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all ${badgeStyle} ${
                  isLocked ? "cursor-not-allowed opacity-50" : "hover:scale-105"
                }`}
              >
                <span>G{st.stage_id}</span>
                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isSkipped && <FastForward className="w-3.5 h-3.5 text-rose-400" />}
                {isCurrent && <PlayCircle className="w-3.5 h-3.5 text-[#d4af37]" />}
                {isLocked && <Lock className="w-3 h-3 text-gray-500" />}
                {isCompleted && <span className="text-[10px] text-emerald-300 font-bold ml-0.5">+{st.score.toFixed(1)}</span>}
              </button>
            );
          })}
        </div>

        {/* Global Controls & Score */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Mission Timer & Points */}
          <div className="hidden lg:flex items-center gap-4 bg-[#161f33] px-3 py-1 rounded-xl border border-[#23304d]">
            <div>
              <div className="text-[10px] text-gray-400 font-mono uppercase">Total Score</div>
              <div className="text-sm font-extrabold text-[#d4af37] font-mono">
                <span className="whitespace-nowrap">{totalScore.toFixed(2)} <span className="text-xs text-gray-400">/ 100.0</span></span>
              </div>
            </div>
            <div className="w-[1px] h-6 bg-[#23304d]" />
            <div>
              <div className="text-[10px] text-gray-400 font-mono uppercase">Infiltration</div>
              <div className="text-sm font-bold text-gray-200 font-mono">
                {formatTimer(secondsElapsed)}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenDashboard}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs font-mono font-medium text-gray-200 transition"
              title="Team Dashboard"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <button
              onClick={onOpenLeaderboard}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs font-mono font-medium text-gray-200 transition"
              title="Tournament Leaderboard"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Board</span>
            </button>

            <a
              href="/"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-xs font-mono font-medium text-gray-200 transition"
              title="Back to the mission hub (all phases)"
            >
              <span className="hidden sm:inline">Hub</span>
              <span className="sm:hidden">&larr;</span>
            </a>

            {onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="p-1.5 rounded-lg bg-[#161f33] hover:bg-[#202c45] border border-[#23304d] text-gray-400 hover:text-white transition"
                title="Admin Portal"
              >
                <Settings className="w-4 h-4 text-gray-300" />
              </button>
            )}

            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg bg-rose-950/20 hover:bg-rose-900/30 border border-rose-900/30 text-rose-400 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
