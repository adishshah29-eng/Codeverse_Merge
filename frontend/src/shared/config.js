// Base URL of the FastAPI backend. In every normal deployment the frontend and
// API share one origin (Nginx: "/" → React, "/api" → FastAPI), so this stays
// "/api". Override with VITE_API_BASE_URL only if the API lives elsewhere.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");
