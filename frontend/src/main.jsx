import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPwa } from "./lib/pwa";

// Before the first render: the browser may announce that the app is installable at once.
initPwa();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
