import { useSyncExternalStore } from "react";
import { syncActivity } from "../log/local-data";
import { timer } from "../log/timer";
import type { UpdateSafety } from "./can-update";
import { hasTypedText, watchTypedText } from "./typed-text";
import { createUpdater, type Updater, type UpdateView } from "./updater";

/** The one updater for this page, or null where there is no service worker (unit tests too). */
let updater: Updater | null = null;

const NONE: UpdateView = { ready: false, heldByTimer: false, updating: false };
const noSubscribe = () => () => undefined;

/** Everything canUpdateNow() needs to know, read fresh each time it is asked. */
export function safetyNow(): UpdateSafety {
  const sync = syncActivity();
  return {
    timerRunning: timer.isRunning(),
    saving: sync?.busy ?? false,
    unsent: sync?.pending ?? 0,
    canSend: navigator.onLine && sync?.status !== "unreachable",
    typedText: hasTypedText(),
  };
}

/** Called once from main.tsx. Registers the worker after the page has loaded. */
export function startUpdates(): void {
  watchTypedText();
  if (updater !== null || !("serviceWorker" in navigator)) return;
  const created = createUpdater({
    container: navigator.serviceWorker,
    safety: safetyNow,
    reload: () => {
      window.location.reload();
    },
    isOnline: () => navigator.onLine,
    win: window,
    doc: document,
  });
  updater = created;
  // After load, so the worker's first download does not slow the first screen.
  const begin = () => void created.start();
  if (document.readyState === "complete") begin();
  else window.addEventListener("load", begin, { once: true });
}

/** For tests: put a stand-in updater in place (or none). */
export function setUpdater(next: Updater | null): void {
  updater = next;
}

export function useUpdateView(): UpdateView {
  const current = updater;
  return useSyncExternalStore(current ? current.subscribe : noSubscribe, () =>
    current ? current.getView() : NONE,
  );
}

export function updateNow(): void {
  updater?.updateNow();
}

export function screenChanged(): void {
  updater?.screenChanged();
}
