import React, { useState, useEffect } from "react";
import { api } from "./api";
import Navbar from "./components/Navbar";
import HintDrawer from "./components/HintDrawer";
import BlackMarketModal from "./components/BlackMarketModal";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Stage1MoneyTrail from "./pages/Stage1MoneyTrail";
import Stage2ControlServer from "./pages/Stage2ControlServer";
import Stage3OutrunPolice from "./pages/Stage3OutrunPolice";
import Stage4Extraction from "./pages/Stage4Extraction";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [role, setRole] = useState(null); // "team" | "admin" | null
  const [team, setTeam] = useState(null);
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard", "stage1", "stage2", "stage3", "stage4", "admin"
  const [stages, setStages] = useState([]);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [isHintsOpen, setIsHintsOpen] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await api.getMe();
      if (res.authenticated) {
        setRole(res.role);
        if (res.role === "team") {
          setTeam(res.team);
          loadStages();
          setActiveView("dashboard");
        } else if (res.role === "admin") {
          setActiveView("admin");
        }
      } else {
        setRole(null);
        setTeam(null);
      }
    } catch (err) {
      console.error(err);
      setRole(null);
      setTeam(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const loadStages = async () => {
    try {
      const res = await api.getStages();
      setStages(res.stages || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = (userRole, userData) => {
    setRole(userRole);
    if (userRole === "team") {
      setTeam(userData);
      loadStages();
      setActiveView("dashboard");
      api.getMe().then((profile) => {
        if (profile.authenticated && profile.role === "team") setTeam(profile.team);
      }).catch(console.error);
    } else {
      setActiveView("admin");
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      // One shared login for all phases lives on the landing page.
      window.location.assign("/");
    }
  };

  const handleStageCompleted = async (stageId, scoreEarned) => {
    await checkAuth();
    await loadStages();
  };

  const handleSkipStage = async (stageId) => {
    try {
      const res = await api.skipStage(stageId);
      await checkAuth();
      await loadStages();
      return res;
    } catch (err) {
      alert(err.message);
    }
  };

  if (authChecking) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        color: "#fff",
        fontFamily: "var(--font-mono)"
      }}>
        <div style={{ textAlign: "center" }}>
          <div>Loading…</div>
        </div>
      </div>
    );
  }

  if (!role) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", paddingBottom: 60 }}>
      {/* Universal Navigation */}
      <Navbar
        team={team}
        role={role}
        stages={stages}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenMarket={() => setIsMarketOpen(true)}
        onOpenHints={() => setIsHintsOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main>
        {role === "admin" || activeView === "admin" ? (
          <AdminDashboard />
        ) : (
          <>
            {activeView === "dashboard" && (
              <Dashboard
                team={team}
                stages={stages}
                onSelectStage={setActiveView}
                onSkipStage={handleSkipStage}
                onOpenMarket={() => setIsMarketOpen(true)}
                onOpenHints={() => setIsHintsOpen(true)}
              />
            )}

            {activeView === "stage1" && (
              <Stage1MoneyTrail
                team={team}
                onStageCompleted={handleStageCompleted}
              />
            )}

            {activeView === "stage2" && (
              <Stage2ControlServer
                team={team}
                onStageCompleted={handleStageCompleted}
              />
            )}

            {activeView === "stage3" && (
              <Stage3OutrunPolice
                team={team}
                onStageCompleted={handleStageCompleted}
              />
            )}

            {activeView === "stage4" && (
              <Stage4Extraction
                team={team}
                onStageCompleted={handleStageCompleted}
              />
            )}
          </>
        )}
      </main>

      {/* Black Market Modal */}
      <BlackMarketModal
        isOpen={isMarketOpen}
        onClose={() => setIsMarketOpen(false)}
        onFundsUpdated={(newBal) => setTeam((prev) => ({ ...prev, money: newBal }))}
      />

      {/* Intel / Hint Drawer */}
      <HintDrawer
        isOpen={isHintsOpen}
        onClose={() => setIsHintsOpen(false)}
        onHintUsed={() => checkAuth()}
      />
    </div>
  );
}
