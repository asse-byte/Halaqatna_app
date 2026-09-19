import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Halaqtna — student dashboard + administration console (React + Vite + Tailwind).
//
// In production nginx serves `dist/` and proxies /api and /p to Laravel on the internal
// bridge, so the SPA, the API and the public card all share one origin (§1 network rule).
// The dev server reproduces that single origin with a proxy, so the browser never needs CORS.
//
//   VITE_API_PROXY_TARGET — dev only, read here in Node: where the proxy forwards to.
//   VITE_API_URL          — read by the browser (src/lib/api.js); normally empty = same origin.
export default defineConfig(({ mode }) => {
  const root = import.meta.dirname;
  const env = loadEnv(mode, root, "VITE_");
  const target = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(root, "src") } },
    server: {
      port: 3000,
      proxy: {
        "/api": { target, changeOrigin: true },
        "/p": { target, changeOrigin: true },
      },
    },
  };
});
