import React, { useState, useEffect } from "react";
import { 
  MapPin, Navigation, Shield, Clock, AlertTriangle, 
  CheckCircle, Play, Undo2, RotateCcw, Zap
} from "lucide-react";
import { game4Api } from "../api";

export default function Game4MintMap({ onStageComplete, dashboard, onRefresh }) {
  const [dataset, setDataset] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState([0]); // Starts at Chamber 0
  const [evalResult, setEvalResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState(null);

  useEffect(() => {
    loadMapData();
  }, []);

  const loadMapData = async () => {
    try {
      const data = await game4Api.getDataset();
      setDataset(data);
    } catch (err) {
      console.error("Failed to load Game 4 dataset:", err);
    }
  };

  const rooms = dataset?.rooms || [];
  const edges = dataset?.edges || [];

  const handleRoomClick = async (roomId) => {
    // If clicking already in route
    if (selectedRoute.includes(roomId)) {
      if (roomId === selectedRoute[selectedRoute.length - 1] && selectedRoute.length > 1) {
        // Pop last
        const newRoute = selectedRoute.slice(0, -1);
        setSelectedRoute(newRoute);
        evaluateRoute(newRoute);
      }
      return;
    }

    const currentRoom = selectedRoute[selectedRoute.length - 1];
    // Check if connected
    const isEdge = edges.some(
      (e) => (e.from === currentRoom && e.to === roomId) || (e.to === currentRoom && e.from === roomId)
    );

    if (!isEdge) {
      alert(`No direct corridor connects Room ${currentRoom} and Room ${roomId}!`);
      return;
    }

    const newRoute = [...selectedRoute, roomId];
    setSelectedRoute(newRoute);
    evaluateRoute(newRoute);
  };

  const evaluateRoute = async (route) => {
    if (!route || route.length === 0) return;
    try {
      const res = await game4Api.evaluateRoute(route);
      setEvalResult(res);
    } catch (err) {
      console.error("Route evaluation error:", err);
    }
  };

  const handleResetRoute = () => {
    setSelectedRoute([0]);
    evaluateRoute([0]);
    setSubmissionFeedback(null);
  };

  const handleSubmitRoute = async () => {
    if (!evalResult?.reached_exit && selectedRoute[selectedRoute.length - 1] !== 20) {
      alert("Infiltration path must reach Room 20 (Exit Gate).");
      return;
    }
    setSubmitting(true);
    setSubmissionFeedback(null);

    const idempotencyKey = `g4-${Date.now()}-${selectedRoute.join("-")}`;
    try {
      const res = await game4Api.submit({
        idempotency_key: idempotencyKey,
        route: selectedRoute
      });
      setSubmissionFeedback(res);
      if (res.passed) {
        await onRefresh();
        setTimeout(() => {
          onStageComplete(5);
        }, 1800);
      }
    } catch (err) {
      setSubmissionFeedback({ passed: false, message: err.message || "Route rejected." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-rise">
      
      {/* Header */}
      <div className="p-5 rounded-2xl glass-panel-glow border border-[#D2362B]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-sans text-emerald-400 font-bold uppercase tracking-wider">
            <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/40">STAGE 04</span>
            <span>ALGORITHMS & GRAPH INFILTRATION</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-semibold text-white tracking-tight mt-1">
            La Ruta del Profesor: The Leak + Mint Map
          </h2>
          <p className="text-xs text-gray-400 font-sans mt-1 max-w-2xl">
            Plot the optimal escape path through the 21 vault chambers (Chamber 0 &rarr; Chamber 20). Avoid patrol windows.
            <span className="text-[#E9DFCB]"> Score = Risk + 2 &times; Time</span> (Lower cost = higher points, max 10.0 pts).
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-[#161210] border border-[#352D27] text-center font-sans">
          <div className="text-[10px] text-gray-400 uppercase">Max Score</div>
          <div className="text-sm font-extrabold text-[#E9DFCB]">10.00 pts</div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SVG Tactical Blueprint Map (8 Cols) */}
        <div className="lg:col-span-8 glass-panel p-4 rounded-2xl border border-[#352D27] flex flex-col">
          <div className="flex items-center justify-between mb-3 text-xs font-sans text-gray-300">
            <div className="flex items-center gap-2 font-bold">
              <Navigation className="w-4 h-4 text-[#E9DFCB]" />
              <span>Chamber Blueprint & Patrol Telemetry</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetRoute}
                className="px-2.5 py-1 rounded bg-[#161210] hover:bg-[#1F1A17] border border-[#352D27] text-[11px] font-sans text-gray-400 hover:text-white flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset Path
              </button>
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="w-full bg-[#0A0807] rounded-xl border border-[#352D27] p-2 overflow-x-auto">
            <svg viewBox="0 0 760 540" className="w-full h-auto min-w-[680px]">
              <defs>
                <linearGradient id="activeRouteGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#D2362B" />
                  <stop offset="100%" stopColor="#E9DFCB" />
                </linearGradient>
              </defs>

              {/* Draw Edges */}
              {edges.map((e, idx) => {
                const r1 = rooms.find((r) => r.id === e.from);
                const r2 = rooms.find((r) => r.id === e.to);
                if (!r1 || !r2) return null;

                // Check if this edge is in selectedRoute
                let isTraversed = false;
                for (let i = 0; i < selectedRoute.length - 1; i++) {
                  if (
                    (selectedRoute[i] === e.from && selectedRoute[i + 1] === e.to) ||
                    (selectedRoute[i] === e.to && selectedRoute[i + 1] === e.from)
                  ) {
                    isTraversed = true;
                    break;
                  }
                }

                return (
                  <g key={`edge-${idx}`}>
                    <line
                      x1={r1.x}
                      y1={r1.y}
                      x2={r2.x}
                      y2={r2.y}
                      stroke={isTraversed ? "url(#activeRouteGrad)" : "#241E1A"}
                      strokeWidth={isTraversed ? "4" : "1.5"}
                      strokeDasharray={isTraversed ? "" : "3,3"}
                      className="transition-all"
                    />
                    <text
                      x={(r1.x + r2.x) / 2}
                      y={(r1.y + r2.y) / 2 - 3}
                      fill={isTraversed ? "#D2362B" : "#5C5148"}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      {e.travel_time}m
                    </text>
                  </g>
                );
              })}

              {/* Draw Nodes */}
              {rooms.map((r) => {
                const isSelected = selectedRoute.includes(r.id);
                const isCurrent = selectedRoute[selectedRoute.length - 1] === r.id;
                const isStart = r.type === "start";
                const isEnd = r.type === "end";

                let fill = "#161210";
                let stroke = "#352D27";
                if (isCurrent) {
                  fill = "#D2362B";
                  stroke = "#ffffff";
                } else if (isSelected) {
                  fill = "#E9DFCB";
                  stroke = "#ffffff";
                } else if (isStart) {
                  fill = "#E9DFCB";
                  stroke = "#E9DFCB";
                } else if (isEnd) {
                  fill = "#F0624F";
                  stroke = "#F0624F";
                }

                return (
                  <g
                    key={`room-${r.id}`}
                    onClick={() => handleRoomClick(r.id)}
                    className="cursor-pointer hover:opacity-90"
                  >
                    <circle
                      cx={r.x}
                      cy={r.y}
                      r={isCurrent ? "18" : "14"}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={isCurrent ? "3" : "1.5"}
                      className="transition-all"
                    />
                    <text
                      x={r.x}
                      y={r.y + 4}
                      fill={isCurrent || isSelected ? "#000000" : "#ffffff"}
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      {r.id}
                    </text>
                    <text
                      x={r.x}
                      y={r.y + 25}
                      fill="#A89A88"
                      fontSize="8.5"
                      fontFamily="Inter, sans-serif"
                      textAnchor="middle"
                    >
                      {r.name}
                    </text>
                    <text
                      x={r.x}
                      y={r.y - 18}
                      fill="#D2362B"
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="middle"
                    >
                      [{r.window[0]}-{r.window[1]}m]
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 font-sans mt-2">
            <span>&bull; Green: Chamber 0 (Start) &bull; Red: Chamber 20 (Exit)</span>
            <span>Click connected chambers to plot transit path</span>
          </div>
        </div>

        {/* Right Telemetry & Submission (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Path Telemetry Card */}
          <div className="glass-panel p-5 rounded-2xl border border-[#352D27] space-y-4">
            <h3 className="text-xs font-sans font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#E9DFCB]" />
              Infiltration Telemetry
            </h3>

            {/* Path nodes list */}
            <div>
              <span className="text-[10px] text-gray-400 font-sans block mb-1">Traversed Path:</span>
              <div className="p-2.5 rounded-xl bg-[#0A0807] border border-[#352D27] font-sans text-xs font-bold text-white flex flex-wrap items-center gap-1">
                {selectedRoute.map((rid, idx) => (
                  <React.Fragment key={idx}>
                    <span className="px-1.5 py-0.5 rounded bg-[#161210] text-[#E9DFCB]">
                      {rid}
                    </span>
                    {idx < selectedRoute.length - 1 && <span className="text-gray-600">&rarr;</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-center font-sans">
              <div className="p-2 rounded-xl bg-[#161210] border border-[#352D27]">
                <div className="text-[9px] text-gray-400 uppercase">Risk</div>
                <div className="text-sm font-bold text-rose-400">
                  {evalResult?.risk ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#161210] border border-[#352D27]">
                <div className="text-[9px] text-gray-400 uppercase">Time</div>
                <div className="text-sm font-bold text-[#E9DFCB]">
                  {evalResult?.time ?? 0}m
                </div>
              </div>
              <div className="p-2 rounded-xl bg-[#161210] border border-[#352D27]">
                <div className="text-[9px] text-gray-400 uppercase">Cost</div>
                <div className="text-sm font-extrabold text-[#E9DFCB]">
                  {evalResult?.cost ?? 0}
                </div>
              </div>
            </div>

            {/* Window alerts */}
            {evalResult?.failures && evalResult.failures.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-sans space-y-1">
                <div className="font-bold flex items-center gap-1 text-rose-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> Patrol Intercepted:
                </div>
                {evalResult.failures.map((f, i) => (
                  <div key={i} className="text-[11px]">
                    &bull; {f.room} (arrived: {f.arrived}m, window: [{f.window.join("-")}]m): {f.reason}
                  </div>
                ))}
              </div>
            )}

            {evalResult?.passed && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-sans flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Legal escape route verified! All patrol security windows satisfied.</span>
              </div>
            )}

            <button
              onClick={handleSubmitRoute}
              disabled={submitting || !evalResult?.passed}
              className={`w-full py-2.5 rounded-xl font-sans text-xs font-bold uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                evalResult?.passed
                  ? "bg-red text-white"
                  : "bg-[#161210] text-gray-500 border border-[#352D27] cursor-not-allowed"
              }`}
            >
              {submitting ? "Executing Escape..." : "Confirm & Execute Infiltration"}
            </button>
          </div>

          {/* Feedback */}
          {submissionFeedback && (
            <div className={`p-3.5 rounded-xl border text-xs font-sans animate-rise ${
              submissionFeedback.passed 
                ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300" 
                : "bg-rose-950/60 border-rose-500/50 text-rose-300"
            }`}>
              <div className="font-bold flex items-center gap-1.5 mb-1">
                {submissionFeedback.passed ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                {submissionFeedback.passed ? "ESCAPE COMPLETE!" : "ROUTE ABORTED"}
              </div>
              <p>{submissionFeedback.message}</p>
              {submissionFeedback.passed && (
                <p className="mt-1 font-bold text-emerald-400">
                  Score Awarded: +{submissionFeedback.score_awarded} pts &bull; Unlocking Final Stage 05...
                </p>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
