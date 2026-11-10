import type { LogSync, SyncStatus } from "./engine";

/**
 * The one door to this phone's copy of the log (docs/data-map.md, "On the phone"), and the only
 * log code in the first load. It is small on purpose: the sync engine and IndexedDB code load
 * as their own file, only once someone is signed in.
 *
 * Threat model #13: on sign-out (this phone or everywhere), on account deletion, and whenever
 * the server answers 401, wipeLocalData() deletes the app's whole IndexedDB database. Unsent
 * changes are lost on a 401: that is the accepted trade for never leaving a family's data on a
 * phone that is no longer signed in.
 */

/** The app's IndexedDB database: this account's entries, the outbox, and the last rev seen. */
export const LOCAL_DB_NAME = "tummy-time";

let running: Promise<LogSync> | null = null;
/** The same engine as `running`, once it has loaded, for callers that cannot wait. */
let loaded: LogSync | null = null;
let onUnauthorized: () => void = () => undefined;

/** The session layer says what to do when the server answers 401 to a sync request. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/** Loads and starts sync (once). Safe to call again: answers the same engine. */
export function startLogSync(): Promise<LogSync> {
  running ??= import("./engine").then(
    (m) => {
      const engine = m.createLogSync({
        onUnauthorized: () => {
          onUnauthorized();
        },
      });
      engine.start();
      loaded = engine;
      return engine;
    },
    (error: unknown) => {
      // The code could not load (no signal on first open). The next call tries again.
      running = null;
      throw error;
    },
  );
  return running;
}

/** Stops sync without deleting anything (the app is closing). */
export function stopLogSync(): void {
  const engine = running;
  running = null;
  loaded = null;
  void engine?.then((e) => {
    e.stop();
  });
}

/**
 * Before a deliberate sign-out: tries once to send every unsent change. Answers how many are
 * still unsent (0 when everything reached the server, or sync never started).
 */
export async function sendBeforeSignOut(): Promise<number> {
  if (running === null) return 0;
  const engine = await running;
  return engine.sendNow();
}

function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => {
      resolve();
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Could not delete the local database."));
    };
    // "blocked" means another tab still has it open. Every tab's engine closes its connection
    // when asked (see store.ts), and then this request goes on to succeed.
  });
}

/**
 * Stops sync and deletes this phone's whole copy of the log, outbox included. The engine is
 * stopped first, so nothing can write to the database (or make a new one) after it is gone.
 */
export async function wipeLocalData(): Promise<void> {
  const engine = running;
  running = null;
  loaded = null;
  if (engine) {
    try {
      (await engine).stop();
    } catch {
      // The engine never loaded (for example, offline at first open). Nothing to stop.
    }
  }
  await deleteDatabase(LOCAL_DB_NAME);
}

/** What sync is doing right now, for the update rule (src/update/). Null when it is not running. */
export interface SyncActivity {
  /** A save on this phone, or a send or pull, is under way. */
  busy: boolean;
  /** Changes waiting in the outbox. */
  pending: number;
  status: SyncStatus;
}

export function syncActivity(): SyncActivity | null {
  if (loaded === null) return null;
  const state = loaded.getState();
  return { busy: loaded.isBusy(), pending: state.pending, status: state.status };
}

/**
 * Whether this phone holds a copy of the log, which it does only while signed in: the database
 * is deleted on every sign-out, account deletion, 401, and before every sign-in. The session
 * layer asks this when the server cannot be reached (src/session.tsx).
 *
 * It never creates the database. indexedDB.databases() lists without opening. Where that is
 * missing, the database is opened without a version: if it did not exist, the browser starts
 * creating it and asks for an upgrade, and aborting that upgrade cancels the creation, so
 * nothing is left behind.
 */
export async function localDataExists(given?: IDBFactory): Promise<boolean> {
  // A browser with IndexedDB switched off has none at all.
  const factory = given ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (factory === undefined) return false;
  // Older Safari has no databases(), whatever the type definitions say.
  if ("databases" in factory) {
    try {
      return (await factory.databases()).some((d) => d.name === LOCAL_DB_NAME);
    } catch {
      // Some browsers list only in a secure context, or refuse in private mode. Fall through.
    }
  }
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(LOCAL_DB_NAME);
    } catch {
      resolve(false);
      return;
    }
    request.onupgradeneeded = () => {
      // Only a database that did not exist yet needs an upgrade when opened with no version.
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      request.result.close();
      resolve(true);
    };
    request.onerror = (event) => {
      // Aborted above (it did not exist), or storage is blocked: either way, no copy here.
      event.preventDefault();
      resolve(false);
    };
  });
}
