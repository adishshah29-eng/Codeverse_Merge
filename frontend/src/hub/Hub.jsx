import React, { useEffect, useState } from "react";
import { Activity, ArrowRight, Lock, LogOut, ShieldCheck } from "lucide-react";
import { api } from "../phase2/api";
import Login from "../phase2/pages/Login";
import { API_BASE } from "../shared/config";

// Landing page at "/": one login for the whole event, then pick a phase.
// Each phase is its own page (/phase1/, /phase2/) sharing the session cookie.
const PHASES = [
  {
    id: 1,
    href: "/phase1/",
    kicker: "PHASE 01",
    title: "Royal Mint Heist + Challenge Arena",
    blurb: "Ten stages. The Royal Mint heist (vault breach, alarm debugging, hidden blueprint, mint map, printing-press ML) followed by five engineering challenges: speed up a URL shortener, bust the TODO-API bugs, crack a binary, build a spreadsheet engine and diagnose a lying regression model.",
    adminBlurb: "Phase 1 team progress, scoring rules, resets and audit log.",
  },
  {
    id: 2,
    href: "/phase2/",
    kicker: "PHASE 02",
    title: "Operación Fuga",
    blurb: "Erase the money trail, take the control server, outrun the police and pull off the final extraction.",
    adminBlurb: "Team accounts, hints, penalties, live configuration (incl. active_phases) and audit events.",
  },
];

export default function Hub() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);
  const [activePhases, setActivePhases] = useState([]);

  const loadSession = async () => {
    try {
      const me = await api.getMe();
      setSession(me.authenticated ? me : null);
      if (me.authenticated) {
        const res = await fetch(`${API_BASE}/phases`, { credentials: "same-origin" });
        const data = await res.json().catch(() => ({}));
        setActivePhases(data.active_phases || []);
      }
    } catch (err) {
      console.error(err);
      setSession(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      setSession(null);
    }
  };

  if (checking) {
    return (
      <div className="hub-center">
        <Activity size={28} />
        <div>ESTABLISHING SECURE CHANNEL...</div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={() => { setChecking(true); loadSession(); }} />;
  }

  const isAdmin = session.role === "admin";
  const who = isAdmin ? session.username : `${session.team?.code} · ${session.team?.name}`;

  return (
    <main className="hub-page">
      <header className="hub-header">
        <div>
          <p className="hub-kicker">CODEVERSE 2.0 · MISSION HUB</p>
          <h1>{isAdmin ? "Organizer Command" : "Choose your operation"}</h1>
          <p className="hub-who">
            {isAdmin ? <ShieldCheck size={15} /> : <Activity size={15} />} {who}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout}>
          <LogOut size={16} /> Sign out
        </button>
      </header>

      <section className="hub-grid">
        {PHASES.map((phase) => {
          const open = isAdmin || activePhases.includes(phase.id);
          const Card = open ? "a" : "div";
          return (
            <Card key={phase.id} className={`hub-card ${open ? "" : "hub-card-locked"}`} {...(open ? { href: phase.href } : {})}>
              <p className="hub-kicker">{phase.kicker}{isAdmin && !activePhases.includes(phase.id) ? " · CLOSED TO TEAMS" : ""}</p>
              <h2>{phase.title}</h2>
              <p>{isAdmin ? phase.adminBlurb : phase.blurb}</p>
              <span className="hub-cta">
                {open ? <>{isAdmin ? "Open admin" : "Enter"} <ArrowRight size={16} /></> : <><Lock size={15} /> Not open yet</>}
              </span>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
