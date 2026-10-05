const API_BASE = "/api";

async function request(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
    credentials: "same-origin",
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.detail || data.message || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  adminLogin: (username, password) => request("/auth/admin-login", { method: "POST", body: JSON.stringify({ username, password }) }),
  getMe: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  // Stages & Progress
  getStages: () => request("/stages"),
  skipStage: (stageId) => request(`/stages/${stageId}/skip`, { method: "POST", body: JSON.stringify({ confirm: true }) }),

  // Hints
  getHints: () => request("/hints"),
  requestHint: (hintId) => request("/hints/request", { method: "POST", body: JSON.stringify({ hint_id: hintId }) }),

  // Stage 1: Money Trail
  getMoneyTrailSchema: () => request("/money_trail/schema"),
  runMoneyTrailQuery: (query) => request("/money_trail/query", { method: "POST", body: JSON.stringify({ query }) }),
  submitDeletionKey: (deletion_key, suspect_txn) => request("/money_trail/submit", { method: "POST", body: JSON.stringify({ deletion_key, suspect_txn }) }),

  // Stage 2: CTF Control Server
  getCtfState: () => request("/ctf/state"),
  tellerLogin: (username, password) => request("/ctf/puzzle1/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  transferFunds: (fromAccount, toAccount, amount) => request("/ctf/puzzle2/transfer", { method: "POST", body: JSON.stringify({ fromAccount, toAccount, amount }) }),
  getBalance: () => request("/ctf/balance"),
  submitCtfCode: (puzzleId, code) => request("/ctf/submit-code", { method: "POST", body: JSON.stringify({ puzzleId, code }) }),

  // Stage 3: Outrun Police
  getPoliceGraph: () => request("/police/graph"),
  getPoliceState: () => request("/police/state"),
  submitPoliceRoute: (route) => request("/police/submit", { method: "POST", body: JSON.stringify({ route }) }),

  // Stage 4: Extraction
  getExtractionStatus: () => request("/extraction/status"),
  verifyExtractionArtifacts: (artifacts) => request("/extraction/verify-artifacts", { method: "POST", body: JSON.stringify(artifacts) }),
  submitExtractionSequence: (sequence) => request("/extraction/submit-sequence", { method: "POST", body: JSON.stringify({ sequence }) }),

  // Black Market
  getMarketCatalog: () => request("/market/catalog"),
  purchaseMarketItem: (category, item_id) => request("/market/purchase", { method: "POST", body: JSON.stringify({ category, item_id }) }),
  unlockMarket: () => request("/market/unlock", { method: "POST" }),

  // Admin
  getAdminDashboard: () => request("/admin/dashboard"),
  createAdminTeam: (team) => request("/admin/teams", { method: "POST", body: JSON.stringify(team) }),
  deleteAdminTeam: (teamId) => request(`/admin/teams/${teamId}`, { method: "DELETE" }),
  listAdminHints: () => request("/admin/hints"),
  toggleAdminHint: (hint_id, enabled) => request("/admin/hints/toggle", { method: "POST", body: JSON.stringify({ hint_id, enabled }) }),
  applyAdminPenalty: (team_id, amount, reason) => request("/admin/penalties/apply", { method: "POST", body: JSON.stringify({ team_id, amount, reason }) }),
  compromisePoliceNode: (node_id, action, team_id = null) => request("/admin/police/compromise", { method: "POST", body: JSON.stringify({ node_id, action, team_id }) }),
  getAdminAuditEvents: () => request("/admin/audit-events"),
};
