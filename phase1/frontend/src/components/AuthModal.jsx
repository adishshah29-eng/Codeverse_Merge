import React, { useState } from "react";
import { Shield, Key, UserPlus, LogIn, Lock } from "lucide-react";
import { authApi } from "../api";

export default function AuthModal({ isOpen, onSuccess, onAdminAccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [adminPasscode, setAdminPasscode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isAdminMode) {
        await authApi.adminLogin(adminPasscode);
        localStorage.setItem("mint_admin_token", adminPasscode);
        onAdminAccess();
      } else if (isRegister) {
        const res = await authApi.register(name, passcode);
        localStorage.setItem("mint_team_id", res.team.id);
        localStorage.setItem("mint_team_name", res.team.name);
        onSuccess(res.team);
      } else {
        const res = await authApi.login(name, passcode);
        localStorage.setItem("mint_team_id", res.team.id);
        localStorage.setItem("mint_team_name", res.team.name);
        onSuccess(res.team);
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg">
      <div className="relative w-full max-w-md glass-panel-glow rounded-2xl border border-[#23304d] overflow-hidden shadow-2xl p-6 sm:p-8">
        
        {/* Emblem */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8c701b] p-0.5 shadow-xl shadow-[#d4af37]/20 flex items-center justify-center mb-3">
            <span className="font-['Impact'] text-2xl text-black tracking-wider">RM</span>
          </div>
          <h2 className="text-lg font-bold text-white uppercase font-mono tracking-wider">
            {isAdminMode ? "Professor Control Room" : "Royal Mint Operative Gate"}
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            {isAdminMode 
              ? "Administrative Command & Tournament Monitor" 
              : "Authenticate your operative team to enter Phase 1"}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-xl bg-[#111726] p-1 border border-[#23304d] mb-6">
          <button
            type="button"
            onClick={() => { setIsAdminMode(false); setIsRegister(false); setError(""); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
              !isAdminMode && !isRegister ? "bg-[#161f33] text-[#d4af37] shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Team Login
          </button>
          <button
            type="button"
            onClick={() => { setIsAdminMode(false); setIsRegister(true); setError(""); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
              !isAdminMode && isRegister ? "bg-[#161f33] text-[#d4af37] shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Register Team
          </button>
          <button
            type="button"
            onClick={() => { setIsAdminMode(true); setError(""); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
              isAdminMode ? "bg-rose-950/60 text-rose-400 border border-rose-500/30 shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            Admin
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isAdminMode ? (
            <>
              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1.5 uppercase tracking-wider">
                  Operative / Team Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tokyo, Berlin, Nairobi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111726] border border-[#23304d] text-white text-sm font-mono focus:outline-none focus:border-[#d4af37] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-gray-300 mb-1.5 uppercase tracking-wider">
                  Team Passcode
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="Passcode for team access"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#111726] border border-[#23304d] text-white text-sm font-mono focus:outline-none focus:border-[#d4af37] transition"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-mono text-rose-300 mb-1.5 uppercase tracking-wider">
                Professor Administrative Passcode
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Master administrative passcode"
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#111726] border border-rose-900/50 text-white text-sm font-mono focus:outline-none focus:border-rose-500 transition"
                />
              </div>
              <p className="text-[11px] text-gray-500 font-mono mt-1">Default master code: PROFESSOR_2026</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 ${
              isAdminMode 
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/40" 
                : "bg-gradient-to-r from-[#d4af37] to-[#b89628] hover:from-[#e5bd3d] hover:to-[#c5a02e] text-black shadow-[#d4af37]/20"
            }`}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : isAdminMode ? (
              <>
                <Lock className="w-4 h-4" /> Enter Professor Command Room
              </>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" /> Enlist New Team Operative
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Access Heist Terminal
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}
