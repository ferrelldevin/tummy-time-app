import { canUpdateNow, whatHoldsUpdate, type UpdateSafety } from "./can-update";

/**
 * Registers the service worker and moves this phone to a new version of the app (Block 7,
 * threat model #17). The worker itself (built by vite-plugin-pwa, see vite.config.ts) keeps
 * the app's files on the phone and never takes over by itself. This file decides when it may.
 *
 * Looking for a new version: when the app starts, when it comes back to the front, when the
 * phone comes back online, and once an hour while it stays open. The browser fetches /sw.js
 * fresh each time (updateViaCache "none"); if it changed, the new worker downloads the new
 * files beside the old ones and then waits.
 *
 * Switching to it means reloading the page, because the page still runs the old files.
 * - The person can press "Update now" (UpdateNotice). A running timer still holds it.
 * - Without asking, at a safe moment, when canUpdateNow() says nothing would be lost:
 *   the app starts with a new version already waiting, comes back to the front, or the person
 *   moves to another screen. A version that arrives later waits for the next such moment.
 * Right before the reload, the rule is checked once more, so a timer started in between wins.
 */

export const CHECK_EVERY_MS = 60 * 60 * 1000;
/** While a save is under way, how often "Update now" looks again. */
export const SAVE_WAIT_MS = 250;
export const SERVICE_WORKER_URL = "/sw.js";

export interface UpdateView {
  /** A newer version is on this phone and the page still runs the older one. */
  ready: boolean;
  /** The person pressed "Update now" while the timer was running. */
  heldByTimer: boolean;
  /** Switching now; the page is about to reload. */
  updating: boolean;
}

export interface UpdaterDeps {
  container: ServiceWorkerContainer;
  safety: () => UpdateSafety;
  reload: () => void;
  isOnline: () => boolean;
  /** Where "online" (window) and "visibilitychange" (document) are heard. */
  win: EventTarget;
  doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  setRepeat?: (fn: () => void, ms: number) => unknown;
  clearRepeat?: (handle: unknown) => void;
}

export interface Updater {
  start: () => Promise<void>;
  stop: () => void;
  getView: () => UpdateView;
  subscribe: (listener: () => void) => () => void;
  /** The person moved to another screen. */
  screenChanged: () => void;
  /** The person pressed "Update now". */
  updateNow: () => void;
}

export function createUpdater(deps: UpdaterDeps): Updater {
  const { container } = deps;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    deps.clearTimer ??
    ((h: unknown) => {
      clearTimeout(h as ReturnType<typeof setTimeout>);
    });
  const setRepeat = deps.setRepeat ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
  const clearRepeat =
    deps.clearRepeat ??
    ((h: unknown) => {
      clearInterval(h as ReturnType<typeof setInterval>);
    });

  let registration: ServiceWorkerRegistration | null = null;
  /** The worker in charge of this page right now, as last seen. */
  let controller: ServiceWorker | null = container.controller;
  /** A newer worker took charge after this page loaded: its files are newer than the page. */
  let pageIsOld = false;
  /** Who asked for the switch that is under way, so the last check uses the right rule. */
  let askedBy: "person" | "moment" | null = null;
  let saveWait: unknown = null;
  let repeat: unknown = null;
  let stopped = false;
  let view: UpdateView = { ready: false, heldByTimer: false, updating: false };
  const listeners = new Set<() => void>();

  function emit(patch: Partial<UpdateView>) {
    const next = { ...view, ...patch };
    if (
      next.ready === view.ready &&
      next.heldByTimer === view.heldByTimer &&
      next.updating === view.updating
    ) {
      return;
    }
    view = next;
    for (const listener of listeners) listener();
  }

  function hasUpdate(): boolean {
    // A waiting worker only means "newer than this page" when a worker already runs this page.
    return pageIsOld || (registration?.waiting != null && controller !== null);
  }

  function noticeChanges() {
    emit({ ready: hasUpdate() });
  }

  /** The last word before reloading. Answers whether it reloaded. */
  function reloadIfStillSafe(): boolean {
    const state = deps.safety();
    const byPerson = askedBy === "person";
    const safe = byPerson ? whatHoldsUpdate(state) === null : canUpdateNow(state);
    askedBy = null;
    if (!safe) {
      // Something started in between (a timer, a save). Wait for the next moment or press.
      emit({ updating: false, ready: hasUpdate(), heldByTimer: byPerson && state.timerRunning });
      return false;
    }
    emit({ updating: true });
    deps.reload();
    return true;
  }

  function apply(by: "person" | "moment") {
    askedBy = by;
    if (pageIsOld) {
      // The new worker is already in charge (another tab switched): only the reload is left.
      reloadIfStillSafe();
      return;
    }
    const waiting = registration?.waiting;
    if (!waiting) {
      askedBy = null;
      return;
    }
    emit({ updating: true });
    // The generated worker calls skipWaiting() on this message and nowhere else
    // (scripts/check-precache.mjs checks that). It then takes charge: see onControllerChange.
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  function onControllerChange() {
    const previous = controller;
    controller = container.controller;
    // The very first worker taking charge of a page it did not load: same files, nothing to do.
    if (previous === null) return;
    pageIsOld = true;
    if (askedBy === null) {
      // Another tab switched. This page waits for its own safe moment.
      noticeChanges();
      return;
    }
    reloadIfStillSafe();
  }

  function atSafeMoment() {
    if (view.heldByTimer && !deps.safety().timerRunning) emit({ heldByTimer: false });
    if (!hasUpdate() || askedBy !== null) return;
    if (canUpdateNow(deps.safety())) apply("moment");
  }

  function check() {
    if (stopped || registration === null || !deps.isOnline()) return;
    registration.update().catch(() => {
      // Offline after all, or the server is down. The next check tries again.
    });
  }

  function watch(worker: ServiceWorker | null) {
    worker?.addEventListener("statechange", () => {
      // "installed": it has every file and now waits. "redundant": it was replaced or failed.
      if (worker.state === "installed" || worker.state === "redundant") noticeChanges();
    });
  }

  function onUpdateFound() {
    watch(registration?.installing ?? null);
  }

  function onVisibility() {
    if (deps.doc.visibilityState !== "visible") return;
    atSafeMoment();
    check();
  }

  function onOnline() {
    check();
  }

  function updateNow() {
    if (saveWait !== null) {
      clearTimer(saveWait);
      saveWait = null;
    }
    if (!hasUpdate() || askedBy !== null) return;
    const hold = whatHoldsUpdate(deps.safety());
    if (hold === "timer") {
      emit({ heldByTimer: true, updating: false });
      return;
    }
    emit({ heldByTimer: false, updating: true });
    if (hold === "saving") {
      // A save takes a moment (a send gives up after 20 seconds). Look again shortly.
      saveWait = setTimer(() => {
        saveWait = null;
        updateNow();
      }, SAVE_WAIT_MS);
      return;
    }
    apply("person");
  }

  return {
    start: async () => {
      container.addEventListener("controllerchange", onControllerChange);
      try {
        registration = await container.register(SERVICE_WORKER_URL, {
          scope: "/",
          updateViaCache: "none",
        });
      } catch {
        // No worker (blocked, or a private window in some browsers). The app still works online.
        return;
      }
      if (stopped) return;
      registration.addEventListener("updatefound", onUpdateFound);
      watch(registration.installing);
      noticeChanges();
      // A version that was already waiting when the app started: a fresh start is a safe moment.
      if (view.ready) atSafeMoment();
      check();
      deps.win.addEventListener("online", onOnline);
      deps.doc.addEventListener("visibilitychange", onVisibility);
      repeat = setRepeat(check, CHECK_EVERY_MS);
    },
    stop: () => {
      stopped = true;
      container.removeEventListener("controllerchange", onControllerChange);
      registration?.removeEventListener("updatefound", onUpdateFound);
      deps.win.removeEventListener("online", onOnline);
      deps.doc.removeEventListener("visibilitychange", onVisibility);
      if (repeat !== null) clearRepeat(repeat);
      if (saveWait !== null) clearTimer(saveWait);
      listeners.clear();
    },
    getView: () => view,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    screenChanged: atSafeMoment,
    updateNow,
  };
}
