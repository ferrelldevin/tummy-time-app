import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App";
import "./design/tokens.css";
import "./styles.css";
import { listenForInstall } from "./install/install-prompt";
import { startUpdates } from "./update/updates";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element in index.html");
}
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Offline and install (Block 7): the service worker, update checks, and the browser's own
// "install" offer, which only the Add to your home screen page uses.
startUpdates();
listenForInstall();
