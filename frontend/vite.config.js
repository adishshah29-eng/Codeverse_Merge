import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One build, three pages that share the API and the login cookie:
//   /         → index.html         (mission hub + login)
//   /phase1/  → phase1/index.html  (Royal Mint Heist, Tailwind)
//   /phase2/  → phase2/index.html  (Operación Fuga)
// Separate pages keep each phase's global CSS isolated from the other.
//
// In development the Vite server proxies /api and /vendor to FastAPI, so the
// browser only ever talks to one origin — exactly like Nginx in production.
const backend = process.env.VITE_DEV_BACKEND || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    // Phase 2's 3D getaway bundles three.js (~600 kB); that is expected.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        hub: resolve(import.meta.dirname, "index.html"),
        phase1: resolve(import.meta.dirname, "phase1/index.html"),
        phase2: resolve(import.meta.dirname, "phase2/index.html"),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/vendor": { target: backend, changeOrigin: true },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/vendor": { target: backend, changeOrigin: true },
    },
  },
});
