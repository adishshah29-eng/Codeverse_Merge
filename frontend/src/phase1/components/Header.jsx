import React from "react";

// One quiet row: who you are, your score, and four text links. Stage navigation lives in <StageBar/>.
export default function Header({ team, dashboard, onOpenDashboard, onOpenLeaderboard, onOpenAdmin, onLogout }) {
  const total = dashboard?.total_score || 0;
  const max = Number(dashboard?.max_total_score ?? 100);
  const rank = dashboard?.rank ? `#${dashboard.rank}` : null;
  const link = "text-[13px] text-beige-dim hover:text-white";

  return (
    <header className="bg-ink border-b border-rule">
      <div className="h-[3px] bg-red" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <div className="min-w-0">
          <span className="font-display text-lg font-semibold text-white">Codeverse</span>
          <span className="mx-2 text-rule">/</span>
          <span className="text-sm text-beige-dim">{team?.name || "Phase 1"}</span>
        </div>

        <div className="ml-auto flex items-center gap-6">
          <p className="text-sm text-beige-dim" title="Your total score">
            <span className="font-display text-xl font-semibold text-white tabular-nums">{total.toFixed(1)}</span>
            <span className="text-beige-faint"> / {max.toFixed(0)}</span>
            {rank && <span className="ml-3 text-beige">{rank}</span>}
          </p>
          <nav className="hidden sm:flex items-center gap-5" aria-label="Account">
            <button onClick={onOpenDashboard} className={link}>Dashboard</button>
            <button onClick={onOpenLeaderboard} className={link}>Leaderboard</button>
            {onOpenAdmin && <button onClick={onOpenAdmin} className={link}>Admin</button>}
            <a href="/" className={link}>Hub</a>
            <button onClick={onLogout} className={link}>Sign out</button>
          </nav>
        </div>
      </div>
      {/* Small screens: the links drop under the bar */}
      <nav className="sm:hidden flex gap-5 px-4 pb-2 overflow-x-auto" aria-label="Account">
        <button onClick={onOpenDashboard} className={link}>Dashboard</button>
        <button onClick={onOpenLeaderboard} className={link}>Leaderboard</button>
        {onOpenAdmin && <button onClick={onOpenAdmin} className={link}>Admin</button>}
        <a href="/" className={link}>Hub</a>
        <button onClick={onLogout} className={link}>Sign out</button>
      </nav>
    </header>
  );
}
