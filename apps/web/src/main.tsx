import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router";
import { App } from "./App";
import "./design/tokens.css";
import "./styles.css";
import { listenForInstall } from "./install/install-prompt";
import { startUpdates } from "./update/updates";

async function start() {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Missing #root element in index.html");
  }
  // Demo build only (DEMO=1, see vite.config.ts): the pretend in-browser API, and screens kept
  // in memory instead of the address bar, so the page runs inside any host's frame, including a
  // claude.ai Artifact. In every other build __DEMO__ is false, so Vite drops this import and
  // the demo code is not in the bundle.
  if (__DEMO__) {
    const { installDemoServer } = await import("./demo/demo-server");
    installDemoServer();
  }
  const Router = __DEMO__ ? MemoryRouter : BrowserRouter;
  createRoot(root).render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>,
  );

  // Offline and install (Block 7): the service worker, update checks, and the browser's own
  // "install" offer, which only the Add to your home screen page uses. The demo has no worker.
  if (!__DEMO__) startUpdates();
  listenForInstall();
}

void start();
