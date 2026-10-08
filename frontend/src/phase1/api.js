import { API_BASE as PLATFORM_API } from "../shared/config";

// Phase 1 endpoints live under /api/phase1. Identity comes from the httpOnly
// session cookie set by the shared login — no team id or admin passcode is
// stored in the browser or sent in headers.
const API_BASE = `${PLATFORM_API}/phase1`;

async function request(url, method = "GET", body = null, customHeaders = {}) {
  const options = {
    method,
    headers: { "Content-Type": "application/json", ...customHeaders },
    credentials: "same-origin",
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.detail || data.message || `API Error: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export function apiRequest(endpoint, method = "GET", body = null, customHeaders = {}) {
  return request(`${API_BASE}${endpoint}`, method, body, customHeaders);
}

// ── Platform session (shared with Phase 2 and the landing page) ──
export const authApi = {
  me: () => request(`${PLATFORM_API}/auth/me`),
  logout: () => request(`${PLATFORM_API}/auth/logout`, "POST"),
};

// ── Progression API ──
export const progressApi = {
  getDashboard: () => apiRequest("/progress/dashboard"),
  skipStage: (stageId) => apiRequest("/progress/skip", "POST", { stage_id: stageId }),
  unlockHint: (stageId, hintIndex) => apiRequest("/progress/hint", "POST", { stage_id: stageId, hint_index: hintIndex }),
};

// ── Game 1 API (Vault Breach) ──
export const game1Api = {
  getChallenge: () => apiRequest("/games/1/challenge"),
  submit: (payload) => apiRequest("/games/1/submit", "POST", payload),
};

// ── Game 2 API (Alarm System) ──
export const game2Api = {
  getChallenges: () => apiRequest("/games/2/challenges"),
  runCode: (code) => apiRequest("/games/2/run", "POST", { code }),
  submit: (payload) => apiRequest("/games/2/submit", "POST", payload),
};

// ── Game 3 API (Hidden Blueprint) ──
export const game3Api = {
  ping: () => apiRequest("/games/3/ping"),
  manifest: () => apiRequest("/games/3/manifest"),
  press: () => apiRequest("/games/3/press"),
  queryBlueprint: (fragment) => apiRequest(`/games/3/blueprint?fragment=${encodeURIComponent(fragment)}`),
  submit: (payload) => apiRequest("/games/3/submit", "POST", payload),
};

// ── Game 4 API (Mint Map) ──
export const game4Api = {
  getDataset: () => apiRequest("/games/4/dataset"),
  evaluateRoute: (route) => apiRequest("/games/4/evaluate", "POST", { route }),
  submit: (payload) => apiRequest("/games/4/submit", "POST", payload),
};

// ── Game 5 API (Printing Press ML) ──
export const game5Api = {
  getInfo: () => apiRequest("/games/5/info"),
  runModel: (code) => apiRequest("/games/5/run", "POST", { code }),
  submit: (payload) => apiRequest("/games/5/submit", "POST", payload),
};

// ── Challenge Arena stages 6-10 (same shape for all five) ──
export const stageApi = {
  getBrief: (stageId) => apiRequest(`/games/${stageId}/brief`),
  handoutUrl: (stageId) => `${API_BASE}/games/${stageId}/handout`,
  submit: (stageId, payload) => apiRequest(`/games/${stageId}/submit`, "POST", payload),
  finalize: (stageId) => apiRequest(`/games/${stageId}/finalize`, "POST"),
};

// ── Leaderboard API ──
export const leaderboardApi = {
  getLeaderboard: () => apiRequest("/leaderboard"),
};

// ── Admin API ──
export const adminApi = {
  getTeams: () => apiRequest("/admin/teams"),
  updateTeam: (teamId, data) => apiRequest(`/admin/teams/${teamId}`, "PATCH", data),
  deleteTeam: (teamId) => apiRequest(`/admin/teams/${teamId}`, "DELETE"),
  getConfig: () => apiRequest("/admin/config"),
  updateConfig: (config) => apiRequest("/admin/config", "PUT", config),
  getAuditLogs: () => apiRequest("/admin/audit-logs"),
};
