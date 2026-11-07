import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable app (public/sw.js). Production builds only: in development the worker would serve
// yesterday's shell over today's edits. The build id in the URL makes every deploy a new worker.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`/sw.js?v=${import.meta.env.VITE_BUILD_ID}`).catch(() => {});
  });
}
