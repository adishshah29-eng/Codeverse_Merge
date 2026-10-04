import React, { useState } from "react";
import { Activity, ArrowRight, LockKeyhole, ShieldCheck, Users } from "lucide-react";
import { api } from "../api";

export default function Login({ onLoginSuccess }) {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isAdminMode) {
        const res = await api.adminLogin(adminUser, adminPass);
        onLoginSuccess("admin", { username: res.username });
      } else {
        const res = await api.login(email, password);
        onLoginSuccess("team", res.team);
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Check your access credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-topline">
        <span><Activity size={15} /> FUGA / CONTROL ROOM</span>
        <span><i className="signal-dot" /> SECURE CHANNEL</span>
      </div>
      <section className="login-console">
        <div className="login-brief">
          <div className="login-mark"><Activity size={26} /></div>
          <p className="login-kicker">ROYAL MINT · OPERATION FUGA</p>
          <h1>THE PLAN<br /><em>IS LIVE.</em></h1>
          <div className="login-readout"><span>MISSION STATUS</span><strong><i className="signal-dot" /> AWAITING CREW AUTHORIZATION</strong></div>
          <div className="login-coordinate">40°24' N &nbsp; 3°42' W <span>·</span> MADRID, ES</div>
        </div>

        <div className="login-access">
          <div className="login-access-heading">
            {isAdminMode ? <ShieldCheck size={19} /> : <Users size={19} />}
            <span>{isAdminMode ? "ORGANIZER ACCESS" : "CREW AUTHENTICATION"}</span>
          </div>
          <div className="login-mode" role="group" aria-label="Sign-in type">
            <button type="button" className={!isAdminMode ? "selected" : ""} onClick={() => { setIsAdminMode(false); setError(""); }}>
              <Users size={15} /> CREW
            </button>
            <button type="button" className={isAdminMode ? "selected" : ""} onClick={() => { setIsAdminMode(true); setError(""); }}>
              <ShieldCheck size={15} /> ORGANIZER
            </button>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {!isAdminMode ? <>
              <label htmlFor="crew-email">SUPABASE ACCOUNT EMAIL</label>
              <input id="crew-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="crew@example.com" autoComplete="username" required />
              <label htmlFor="crew-password">PASSWORD</label>
              <input id="crew-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter crew password" autoComplete="current-password" required />
            </> : <>
              <label htmlFor="admin-user">ORGANIZER USERNAME</label>
              <input id="admin-user" type="text" value={adminUser} onChange={(event) => setAdminUser(event.target.value)} autoComplete="username" required />
              <label htmlFor="admin-password">PASSWORD</label>
              <input id="admin-password" type="password" value={adminPass} onChange={(event) => setAdminPass(event.target.value)} autoComplete="current-password" required />
            </>}
            <button className="login-submit" type="submit" disabled={loading}>
              <LockKeyhole size={16} /> {loading ? "VERIFYING CREDENTIALS" : isAdminMode ? "OPEN COMMAND" : "AUTHENTICATE CREW"} <ArrowRight size={16} />
            </button>
          </form>
          <p className="login-footnote">AUTHORIZED PERSONNEL ONLY <span>·</span> ALL ACTIVITY LOGGED</p>
        </div>
      </section>
      <div className="login-footer"><span>CODEVERSE 2.0</span><span>OPERATION FUGA <b>—</b> CENTRAL CONTROL</span></div>
    </main>
  );
}
