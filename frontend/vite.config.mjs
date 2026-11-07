import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

// Halaqtna — student dashboard + administration console (React + Vite + Tailwind).
//
// In production nginx serves `dist/` and proxies /api and /p to Laravel on the internal
// bridge, so the SPA, the API and the public card all share one origin (§1 network rule).
// The dev server reproduces that single origin with a proxy, so the browser never needs CORS.
//
//   VITE_API_PROXY_TARGET — dev only, read here in Node: where the proxy forwards to.
//   VITE_API_URL          — read by the browser (src/lib/api.js); normally empty = same origin.

// One id per build. The page reads it (import.meta.env.VITE_BUILD_ID), and the service worker
// (sw.js, beside this file) is emitted to dist/sw.js with the id written in. So every deploy
// changes the worker's bytes, an open app notices the new version on its own, and the worker
// names its cache after it. sw.js stays out of public/ because public/ is copied as it is.
const BUILD_ID = Date.now().toString(36);
const emitServiceWorker = {
  name: "emit-service-worker",
  apply: "build",
  generateBundle() {
    const source = fs.readFileSync(path.resolve(import.meta.dirname, "sw.js"), "utf8").replace("__BUILD_ID__", BUILD_ID);
    this.emitFile({ type: "asset", fileName: "sw.js", source });
  },
};

export default defineConfig(({ mode }) => {
  const root = import.meta.dirname;
  const env = loadEnv(mode, root, "VITE_");
  const target = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

  return {
    plugins: [react(), emitServiceWorker],
    define: { "import.meta.env.VITE_BUILD_ID": JSON.stringify(BUILD_ID) },
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
