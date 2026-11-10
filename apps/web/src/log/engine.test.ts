import { afterEach, describe, expect, it } from "vitest";
import type { LogEntry, PutLogBody } from "@tummy/shared";
import type { ApiFailure, ApiResult, Parser } from "../api";
import { createLogSync, FIRST_RETRY_MS, MAX_RETRY_MS, retryDelay, type LogSync } from "./engine";
import { openLogStore, type LogStore } from "./store";

/**
 * The sync engine against a small in-memory stand-in for the server and a real (fake-indexeddb)
 * IndexedDB. Timers are a hand-driven fake, so retries and their waits are checked exactly.
 */

interface Request {
  method: string;
  path: string;
  body?: unknown;
}

/** A tiny server with the same rules as the real one: one rev counter, last write wins. */
function fakeServer() {
  let rev = 0;
  const rows = new Map<string, LogEntry>();
  const requests: Request[] = [];
  /** Failures to answer with instead, one per request, in order ("ok" lets one through). */
  const failNext: (ApiFailure | "ok")[] = [];
  let pageSize = 500;
  /** While true, every request fails as if there were no network. */
  const state = { down: false };

  function write(entry: Omit<LogEntry, "rev">): LogEntry {
    rev += 1;
    const stored = { ...entry, rev };
    rows.set(entry.id, stored);
    return stored;
  }

  const call = <T>(
    path: string,
    schema: Parser<T>,
    options: { method?: string; body?: unknown } = {},
  ): Promise<ApiResult<T>> => {
    const method = options.method ?? "GET";
    requests.push({ method, path, ...(options.body !== undefined ? { body: options.body } : {}) });
    const failure = state.down ? "network" : failNext.shift();
    if (failure !== undefined && failure !== "ok") {
      return Promise.resolve({ ok: false, error: failure });
    }
    const answer = (data: unknown): Promise<ApiResult<T>> => {
      const parsed = schema.safeParse(data);
      return Promise.resolve(
        parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "unexpected" },
      );
    };
    if (method === "GET") {
      const since = Number(new URL(path, "http://x").searchParams.get("since"));
      const all = [...rows.values()].filter((r) => r.rev > since).sort((a, b) => a.rev - b.rev);
      const entries = all.slice(0, pageSize);
      return answer({
        entries,
        latestRev: entries.at(-1)?.rev ?? since,
        more: all.length > pageSize,
      });
    }
    const id = path.split("/").at(-1) ?? "";
    if (method === "PUT") {
      const body = options.body as PutLogBody;
      return answer(write({ id, ...body, deletedAt: null }));
    }
    const existing = rows.get(id);
    if (!existing) return Promise.resolve({ ok: false, error: "not_found" });
    if (existing.deletedAt !== null) return answer(existing);
    return answer(write({ ...existing, deletedAt: "2026-11-10T12:00:00.000Z" }));
  };

  return {
    call: call as unknown as typeof import("../api").apiCall,
    requests,
    failNext,
    state,
    rows,
    write,
    setPageSize(n: number) {
      pageSize = n;
    },
  };
}

/** A fake timer: nothing runs until the test says so. */
function fakeTimers() {
  const pending: { fn: () => void; ms: number }[] = [];
  return {
    pending,
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn, ms };
      pending.push(t);
      return t;
    },
    clearTimer: (handle: unknown) => {
      const i = pending.indexOf(handle as { fn: () => void; ms: number });
      if (i >= 0) pending.splice(i, 1);
    },
    /** Runs the timer that is waiting, and answers how long it was set for. */
    fire(): number {
      const t = pending.shift();
      if (!t) throw new Error("No timer is waiting.");
      t.fn();
      return t.ms;
    },
  };
}

const START = "2026-11-10T09:00:00.000Z";
const body = (durationSeconds: number, startedAt = START): PutLogBody => ({
  startedAt,
  durationSeconds,
});

let engines: LogSync[] = [];
afterEach(() => {
  for (const e of engines) e.stop();
  engines = [];
});

function setup(options: { online?: boolean; random?: number } = {}) {
  const server = fakeServer();
  const timers = fakeTimers();
  const events = { window: new EventTarget(), document: new EventTarget() as Document };
  Object.defineProperty(events.document, "visibilityState", {
    value: "visible",
    configurable: true,
  });
  let online = options.online ?? true;
  let unauthorized = 0;
  let ids = 0;
  let store: LogStore | null = null;
  const engine = createLogSync({
    onUnauthorized: () => {
      unauthorized += 1;
    },
    call: server.call,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    random: () => options.random ?? 0.5,
    isOnline: () => online,
    newId: () => {
      ids += 1;
      return `00000000-0000-4000-8000-${String(ids).padStart(12, "0")}`;
    },
    openStore: async (onClosed) => {
      store = await openLogStore(onClosed);
      return store;
    },
    events,
  });
  engines.push(engine);
  return {
    engine,
    server,
    timers,
    events,
    setOnline(v: boolean) {
      online = v;
    },
    unauthorized: () => unauthorized,
    store: () => {
      if (!store) throw new Error("store not open yet");
      return store;
    },
  };
}

/** Waits until the engine has nothing left to do right now. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("retryDelay", () => {
  it("doubles from 2 s and stops at 5 minutes", () => {
    const noJitter = () => 1;
    expect([1, 2, 3, 4, 5].map((n) => retryDelay(n, noJitter))).toEqual([
      2000, 4000, 8000, 16000, 32000,
    ]);
    expect(retryDelay(8, noJitter)).toBe(256_000);
    expect(retryDelay(9, noJitter)).toBe(MAX_RETRY_MS);
    expect(retryDelay(500, noJitter)).toBe(MAX_RETRY_MS);
  });

  it("jitter only ever shortens the wait, by at most a quarter", () => {
    expect(retryDelay(1, () => 0)).toBe(FIRST_RETRY_MS * 0.75);
    expect(retryDelay(1, () => 0.999)).toBeLessThanOrEqual(FIRST_RETRY_MS);
    expect(retryDelay(50, () => 0)).toBe(MAX_RETRY_MS * 0.75);
  });
});

describe("the outbox", () => {
  it("saves on the phone first, then sends, in order, one at a time", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.requests.length = 0;
    const one = await s.engine.add(body(60));
    const two = await s.engine.add(body(120));
    // Saved here before anything reached the server.
    expect(
      s.engine
        .getState()
        .entries.map((e) => e.id)
        .sort(),
    ).toEqual([one.id, two.id].sort());
    await settle();
    const writes = s.server.requests.filter((r) => r.method !== "GET");
    expect(writes.map((r) => r.path)).toEqual([`/api/logs/${one.id}`, `/api/logs/${two.id}`]);
    expect(await s.store().pendingCount()).toBe(0);
    expect(s.engine.getState().status).toBe("saved");
    // The server's revs are now on the phone's copy.
    expect((await s.store().allEntries()).every((e) => e.rev !== null)).toBe(true);
  });

  it("holds one change per entry: a newer change replaces the older one waiting", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.state.down = true;
    const entry = await s.engine.add(body(60));
    await settle();
    // The server cannot be reached. Delete it, put it back, delete it again: one change waits.
    await s.engine.remove(entry.id);
    await s.engine.restore(entry);
    await s.engine.remove(entry.id);
    expect(await s.store().pendingCount()).toBe(1);
    expect((await s.store().nextChange())?.op).toBe("delete");
    s.server.requests.length = 0;
    s.server.state.down = false;
    s.timers.fire();
    await settle();
    // Only the latest change went: a DELETE for an entry the server never had, which is done.
    expect(s.server.requests.filter((r) => r.method !== "GET")).toEqual([
      { method: "DELETE", path: `/api/logs/${entry.id}` },
    ]);
    expect(await s.store().pendingCount()).toBe(0);
    expect(await s.store().allEntries()).toEqual([]);
  });

  it("retries with growing waits while the server cannot be reached, then sends", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.failNext.push("network", "network", "internal_error", "rate_limited");
    await s.engine.add(body(60));
    await settle();
    expect(s.engine.getState().status).toBe("unreachable");
    const waits: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      expect(s.timers.pending).toHaveLength(1);
      waits.push(s.timers.fire());
      await settle();
    }
    // 2 s, 4 s, 8 s, 16 s, each shortened by the same jitter (random() is 0.5 here).
    expect(waits).toEqual([2000, 4000, 8000, 16000].map((ms) => ms * 0.875));
    expect(await s.store().pendingCount()).toBe(0);
    expect(s.timers.pending).toHaveLength(0);
    expect(s.engine.getState().status).toBe("saved");
  });

  it("tries again at once when the browser says it is online, or the app comes back to the front", async () => {
    const s = setup({ online: false });
    s.engine.start();
    await settle();
    s.server.failNext.push("network", "network");
    await s.engine.add(body(60));
    await settle();
    // Offline: the change is safe here, and the screen says so.
    expect(s.engine.getState().status).toBe("local");
    s.setOnline(true);
    s.events.window.dispatchEvent(new Event("online"));
    await settle();
    expect(await s.store().pendingCount()).toBe(1);
    s.events.document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(await s.store().pendingCount()).toBe(0);
    expect(s.engine.getState().status).toBe("saved");
    // The waiting retry was cancelled, not left to fire later.
    expect(s.timers.pending).toHaveLength(0);
  });

  it("a change the server refuses for good (400) leaves the outbox and is marked not saved", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.failNext.push("bad_request");
    const refused = await s.engine.add(body(60));
    const fine = await s.engine.add(body(90));
    await settle();
    expect(await s.store().pendingCount()).toBe(0);
    const entries = s.engine.getState().entries;
    expect(entries.find((e) => e.id === refused.id)?.notSaved).toBe(true);
    expect(entries.find((e) => e.id === fine.id)?.notSaved).toBe(false);
    // The next change was not held up by the refused one, and nothing is retried.
    expect(s.server.rows.has(fine.id)).toBe(true);
    expect(s.timers.pending).toHaveLength(0);
  });

  it("a 404 on a PUT (an ID owned by someone else) is dropped and marked the same way", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.failNext.push("not_found");
    const entry = await s.engine.add(body(60));
    await settle();
    expect(s.engine.getState().entries.find((e) => e.id === entry.id)?.notSaved).toBe(true);
  });

  it("a 401 stops sending and hands over to the sign-out wipe", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.failNext.push("unauthorized");
    await s.engine.add(body(60));
    await settle();
    expect(s.unauthorized()).toBe(1);
    expect(s.timers.pending).toHaveLength(0);
    s.server.requests.length = 0;
    s.events.window.dispatchEvent(new Event("online"));
    await settle();
    expect(s.server.requests).toEqual([]);
  });

  it("sendNow tries once and answers how many changes are still unsent", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.failNext.push("network");
    await s.engine.add(body(60));
    await settle();
    s.server.failNext.push("network");
    expect(await s.engine.sendNow()).toBe(1);
    expect(await s.engine.sendNow()).toBe(0);
  });
});

describe("busy, for the update rule (src/update/)", () => {
  it("is busy while a change is being saved here and while it is being sent, and not after", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    expect(s.engine.isBusy()).toBe(false);
    const adding = s.engine.add(body(60));
    // The IndexedDB write has started and not finished.
    expect(s.engine.isBusy()).toBe(true);
    await adding;
    // Saved here; the send to the server starts at once.
    expect(s.engine.isBusy()).toBe(true);
    await settle();
    expect(s.server.rows.size).toBe(1);
    expect(s.engine.isBusy()).toBe(false);
  });

  it("is not busy while it only waits to try again", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.state.down = true;
    await s.engine.add(body(60));
    await settle();
    expect(s.timers.pending).toHaveLength(1);
    expect(s.engine.getState().pending).toBe(1);
    expect(s.engine.isBusy()).toBe(false);
  });
});

describe("pulling", () => {
  it("pulls on start, pages while there is more, and stores the last rev", async () => {
    const s = setup();
    s.server.setPageSize(2);
    for (let i = 0; i < 5; i += 1) {
      s.server.write({
        id: `10000000-0000-4000-8000-00000000000${String(i)}`,
        startedAt: START,
        durationSeconds: 60 + i,
        deletedAt: null,
      });
    }
    s.engine.start();
    await settle();
    expect(s.server.requests.map((r) => r.path)).toEqual([
      "/api/logs?since=0",
      "/api/logs?since=2",
      "/api/logs?since=4",
    ]);
    expect(s.engine.getState().entries).toHaveLength(5);
    expect(await s.store().lastRev()).toBe(5);
  });

  it("pulls again when the app comes back to the front, from the last rev", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.write({
      id: "10000000-0000-4000-8000-000000000001",
      startedAt: START,
      durationSeconds: 60,
      deletedAt: null,
    });
    s.server.requests.length = 0;
    s.events.document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(s.server.requests.map((r) => r.path)).toEqual(["/api/logs?since=0"]);
    expect(s.engine.getState().entries).toHaveLength(1);
  });

  it("a server entry never overwrites a change here that is still waiting to be sent", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    s.server.failNext.push("network");
    const mine = await s.engine.add(body(60));
    await settle();
    // Meanwhile another phone changed the same entry on the server.
    s.server.write({ id: mine.id, startedAt: START, durationSeconds: 999, deletedAt: null });
    await s.store().applyPull([{ ...mine, durationSeconds: 999, rev: 50, deletedAt: null }], 50);
    expect((await s.store().allEntries())[0]?.durationSeconds).toBe(60);
    // Then this phone's change reaches the server, and is the last write: it wins there too.
    s.timers.fire();
    await settle();
    expect(s.server.rows.get(mine.id)?.durationSeconds).toBe(60);
    expect(s.engine.getState().entries[0]?.durationSeconds).toBe(60);
  });

  it("an older server copy never replaces a newer one, and a server delete removes the entry", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    const id = "10000000-0000-4000-8000-000000000009";
    const newer: LogEntry = {
      id,
      startedAt: START,
      durationSeconds: 300,
      rev: 10,
      deletedAt: null,
    };
    await s.store().applyPull([newer], 10);
    await s.store().applyPull([{ ...newer, durationSeconds: 100, rev: 9 }], 10);
    expect((await s.store().allEntries())[0]?.durationSeconds).toBe(300);
    await s.store().applyPull([{ ...newer, rev: 11, deletedAt: "2026-11-10T10:00:00.000Z" }], 11);
    expect(await s.store().allEntries()).toEqual([]);
    expect(await s.store().lastRev()).toBe(11);
  });

  it("a delete made on another phone reaches this one", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    const entry = await s.engine.add(body(60));
    await settle();
    const stored = s.server.rows.get(entry.id);
    if (!stored) throw new Error("not on the server");
    s.server.write({ ...stored, deletedAt: "2026-11-10T10:00:00.000Z" });
    s.events.document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(s.engine.getState().entries).toEqual([]);
  });

  it("entries are shown newest first and deleted ones are hidden at once", async () => {
    const s = setup();
    s.engine.start();
    await settle();
    const early = await s.engine.add(body(60, "2026-11-10T08:00:00.000Z"));
    const late = await s.engine.add(body(60, "2026-11-10T11:00:00.000Z"));
    expect(s.engine.getState().entries.map((e) => e.id)).toEqual([late.id, early.id]);
    await s.engine.remove(late.id);
    expect(s.engine.getState().entries.map((e) => e.id)).toEqual([early.id]);
  });
});
