import { logEntrySchema, logsPageSchema, type LogEntry, type PutLogBody } from "@tummy/shared";
import { apiCall, type ApiFailure, type ApiResult } from "../api";
import { openLogStore, type LocalEntry, type LogStore, type OutboxChange } from "./store";

/**
 * SYNC (ADR 0005, ADR 0009). The server is the source of truth; this phone keeps a copy.
 *
 * - Every change is saved on the phone first and queued in the outbox (store.ts), then sent.
 * - The outbox sends one change at a time, oldest first. A change the server cannot reach
 *   waits and is tried again after 2 s, 4 s, 8 s ... up to 5 minutes, a little shorter at
 *   random so many phones do not all come back at once; and at once when the browser says it is
 *   online again or the app comes back to the front.
 * - A change the server refuses for good (400, 404) leaves the outbox, and its entry is marked
 *   "not saved". A 401 stops everything: the session layer wipes this phone's copy.
 * - The phone pulls "everything after the last rev seen" when sync starts, when the app comes
 *   back to the front, and each time the outbox empties, asking again while the server says
 *   there is more.
 */

export type SyncStatus = "saved" | "local" | "unreachable";

export interface SyncState {
  /** False until this phone's copy has been read from IndexedDB. */
  ready: boolean;
  /** Entries to show: not deleted, newest start time first. */
  entries: LocalEntry[];
  /** Changes waiting to be sent. */
  pending: number;
  status: SyncStatus;
}

export interface LogSync {
  start(): void;
  stop(): void;
  getState: () => SyncState;
  subscribe: (listener: () => void) => () => void;
  /** Logs a new tummy time. Answers the new entry. */
  add(body: PutLogBody): Promise<LocalEntry>;
  /** Deletes an entry. Answers it as it was, for Undo. */
  remove(id: string): Promise<LocalEntry | undefined>;
  /** Undo: puts a deleted entry back exactly as it was. */
  restore(entry: LocalEntry): Promise<void>;
  /** Tries once, now, to send everything queued. Answers how many changes are still unsent. */
  sendNow(): Promise<number>;
  /**
   * True while a change is being saved on this phone, or a send or pull is under way. The app
   * never reloads itself then (src/update/), so no save is cut off half way.
   */
  isBusy(): boolean;
}

/** What the engine needs from the outside world. Tests pass their own. */
export interface SyncDeps {
  onUnauthorized: () => void;
  openStore?: (onClosed: () => void) => Promise<LogStore>;
  call?: typeof apiCall;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  random?: () => number;
  isOnline?: () => boolean;
  newId?: () => string;
  /** Where to listen for "online" and "visibilitychange". */
  events?: { window: EventTarget; document: Document };
}

export const FIRST_RETRY_MS = 2000;
export const MAX_RETRY_MS = 5 * 60 * 1000;
/** A sync request that has not answered after this long counts as "can't reach the server". */
export const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The wait before retry number `failures` (1, 2, 3 ...): 2 s doubled each time, capped at
 * 5 minutes, then shortened by up to a quarter at random. Never longer than the cap.
 */
export function retryDelay(failures: number, random: () => number): number {
  const base = Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.min(failures - 1, 30));
  return Math.round(base * (0.75 + 0.25 * random()));
}

/** Failures that will never succeed if sent again. */
function isPermanent(error: ApiFailure): boolean {
  return (
    error === "bad_request" ||
    error === "not_found" ||
    error === "payload_too_large" ||
    error === "unsupported_media_type"
  );
}

function visible(entries: LocalEntry[]): LocalEntry[] {
  return entries
    .filter((e) => e.deletedAt === null)
    .sort((x, y) => Date.parse(y.startedAt) - Date.parse(x.startedAt));
}

type Step = "done" | "retry" | "stopped";

export function createLogSync(deps: SyncDeps): LogSync {
  const call = deps.call ?? apiCall;
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    deps.clearTimer ??
    ((handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    });
  const random = deps.random ?? Math.random;
  const isOnline = deps.isOnline ?? (() => navigator.onLine);
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const openStore = deps.openStore ?? openLogStore;

  let store: LogStore | null = null;
  let opening: Promise<LogStore> | null = null;
  let stopped = false;
  let state: SyncState = { ready: false, entries: [], pending: 0, status: "saved" };
  const listeners = new Set<() => void>();
  /** stop() can run while a request is out, so this is read again after every wait. */
  const isStopped = () => stopped;

  /** Set when the last send or pull could not reach the server; cleared by the next success. */
  let unreachable = false;
  let failures = 0;
  let retryHandle: unknown = null;
  let running: Promise<void> | null = null;
  let again = false;
  /** Changes being written to IndexedDB right now (see change()). */
  let saving = 0;

  function emit(next: SyncState) {
    state = next;
    for (const listener of listeners) listener();
  }

  function statusNow(pending: number): SyncStatus {
    if (unreachable && isOnline()) return "unreachable";
    return pending > 0 ? "local" : "saved";
  }

  async function refresh(): Promise<void> {
    if (store === null || stopped) return;
    const [all, pending] = await Promise.all([store.allEntries(), store.pendingCount()]);
    if (isStopped()) return;
    emit({ ready: true, entries: visible(all), pending, status: statusNow(pending) });
  }

  function getStore(): Promise<LogStore> {
    opening ??= openStore(() => {
      // This database is being deleted (sign-out, here or in another tab). Stop at once.
      stop();
    }).then(
      (s) => {
        store = s;
        if (stopped) s.close();
        return s;
      },
      (error: unknown) => {
        // IndexedDB could not open (for example, storage is blocked). Try again next time.
        opening = null;
        throw error;
      },
    );
    return opening;
  }

  function signal(): AbortSignal {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }

  function send(change: OutboxChange): Promise<ApiResult<LogEntry>> {
    const path = `/api/logs/${change.id}`;
    return change.op === "put"
      ? call(path, logEntrySchema, { method: "PUT", body: change.body, signal: signal() })
      : call(path, logEntrySchema, { method: "DELETE", signal: signal() });
  }

  /** Handles a failed request. Answers what the loop should do next. */
  function failed(error: ApiFailure): Step {
    if (error === "unauthorized") {
      stop();
      deps.onUnauthorized();
      return "stopped";
    }
    unreachable = true;
    return "retry";
  }

  async function flushOutbox(s: LogStore): Promise<Step> {
    for (;;) {
      if (stopped) return "stopped";
      const change = await s.nextChange();
      if (change === undefined) return "done";
      const result = await send(change);
      if (isStopped()) return "stopped";
      if (result.ok) {
        await s.changeSent(change, result.data);
      } else if (change.op === "delete" && result.error === "not_found") {
        // Not on the server for this account: the delete has nothing left to do.
        await s.changeSent(change, null);
      } else if (isPermanent(result.error)) {
        await s.changeRefused(change);
      } else {
        return failed(result.error);
      }
      unreachable = false;
      failures = 0;
      await refresh();
    }
  }

  async function pullAll(s: LogStore): Promise<Step> {
    for (;;) {
      if (stopped) return "stopped";
      const since = await s.lastRev();
      const result = await call(`/api/logs?since=${String(since)}`, logsPageSchema, {
        signal: signal(),
      });
      if (isStopped()) return "stopped";
      if (!result.ok) return failed(result.error);
      await s.applyPull(result.data.entries, result.data.latestRev);
      unreachable = false;
      failures = 0;
      if (!result.data.more) return "done";
    }
  }

  function scheduleRetry() {
    if (stopped) return;
    failures += 1;
    if (retryHandle !== null) clearTimer(retryHandle);
    retryHandle = setTimer(
      () => {
        retryHandle = null;
        sync();
      },
      retryDelay(failures, random),
    );
  }

  async function cycle(): Promise<void> {
    const s = await getStore();
    if (stopped) return;
    let step = await flushOutbox(s);
    // Pull once the outbox is empty, so a pull never overwrites a change still waiting to go.
    if (step === "done") step = await pullAll(s);
    await refresh();
    if (step === "retry") scheduleRetry();
  }

  /** Runs `work` when no other send or pull is running, so changes go one at a time. */
  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    while (running) await running;
    const done = work();
    const mine = done.then(
      () => undefined,
      () => undefined,
    );
    running = mine;
    try {
      return await done;
    } finally {
      if (running === mine) running = null;
      if (again) {
        again = false;
        sync();
      }
    }
  }

  /** Runs one send-then-pull cycle now, or right after the one already running. */
  function sync(): void {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    if (retryHandle !== null) {
      clearTimer(retryHandle);
      retryHandle = null;
    }
    void exclusive(cycle).catch(() => {
      // IndexedDB failed (storage full, or the database was deleted under us). Try later.
      scheduleRetry();
    });
  }

  const onOnline = () => {
    sync();
  };
  const onOffline = () => {
    void refresh();
  };
  const onVisibility = () => {
    const doc = deps.events?.document ?? document;
    if (doc.visibilityState === "visible") sync();
  };

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (retryHandle !== null) clearTimer(retryHandle);
    retryHandle = null;
    const win = deps.events?.window ?? window;
    const doc = deps.events?.document ?? document;
    win.removeEventListener("online", onOnline);
    win.removeEventListener("offline", onOffline);
    doc.removeEventListener("visibilitychange", onVisibility);
    store?.close();
    listeners.clear();
  }

  async function change(entry: LocalEntry, outbox: Parameters<LogStore["saveChange"]>[1]) {
    saving += 1;
    try {
      const s = await getStore();
      if (stopped) throw new Error("Sync has stopped.");
      await s.saveChange(entry, outbox);
      await refresh();
    } finally {
      saving -= 1;
    }
    sync();
  }

  return {
    start() {
      const win = deps.events?.window ?? window;
      const doc = deps.events?.document ?? document;
      win.addEventListener("online", onOnline);
      win.addEventListener("offline", onOffline);
      doc.addEventListener("visibilitychange", onVisibility);
      void getStore()
        .then(refresh)
        .then(sync)
        .catch(() => {
          scheduleRetry();
        });
    },
    stop,
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async add(body) {
      const entry: LocalEntry = {
        id: newId(),
        startedAt: body.startedAt,
        durationSeconds: body.durationSeconds,
        deletedAt: null,
        rev: null,
        notSaved: false,
      };
      await change(entry, { op: "put", body });
      return entry;
    },

    async remove(id) {
      const s = await getStore();
      const entry = (await s.allEntries()).find((e) => e.id === id);
      if (entry === undefined) return undefined;
      await change({ ...entry, deletedAt: new Date().toISOString() }, { op: "delete" });
      return entry;
    },

    async restore(entry) {
      await change(
        { ...entry, deletedAt: null, notSaved: false },
        {
          op: "put",
          body: { startedAt: entry.startedAt, durationSeconds: entry.durationSeconds },
        },
      );
    },

    async sendNow() {
      if (stopped) return 0;
      return exclusive(async () => {
        const s = await getStore();
        const step = await flushOutbox(s);
        if (step === "stopped") return 0;
        await refresh();
        if (step === "retry") scheduleRetry();
        return s.pendingCount();
      });
    },

    isBusy: () => saving > 0 || running !== null,
  };
}
