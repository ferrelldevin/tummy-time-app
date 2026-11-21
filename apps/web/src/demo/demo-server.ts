import {
  FAMILY_CODE_ALPHABET,
  FAMILY_CODE_LENGTH,
  LOG_PAGE_SIZE,
  isAllowedStartTime,
  logIdSchema,
  logsQuerySchema,
  normalizeFamilyCode,
  putLogBodySchema,
} from "@tummy/shared";
import type { LogEntry } from "@tummy/shared";
import { sampleWeek } from "./sample-data";

/**
 * DEMO BUILD ONLY (DEMO=1, see docs/demo.md). A pretend API that lives in the browser, so the demo runs from
 * any static host with no server and no database. It answers the same paths, with the same
 * shapes (the shared Zod schemas), as apps/api, so every screen runs its real code.
 *
 * What it is not: secure. PINs are kept in plain text in this browser's localStorage, there is
 * no rate limit and no cookie. That is fine for made-up sample data in a demo and is never
 * shipped in the real build: main.tsx loads this file only when the build-time constant
 * __DEMO__ is true, and Vite drops the import from every other build.
 */

const STORAGE_KEY = "tummy-demo-server";

/** The sample family shown on the demo sign-in screen. Made up. */
export const DEMO_FAMILY_CODE = "DEMQ2345TEST";
export const DEMO_PIN = "246810";

interface DemoAccount {
  pin: string;
  rev: number;
  entries: LogEntry[];
}

export interface DemoState {
  accounts: Record<string, DemoAccount>;
  /** Family code this browser is signed in as, or null. Stands in for the session cookie. */
  session: string | null;
  /** The local day ("YYYY-MM-DD") the sample week was last placed on, so it can move forward. */
  sampleDay?: string;
}

function localDay(d: Date): string {
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Noon on a "YYYY-MM-DD" local day, the inverse of localDay for laying out the sample week. */
function dayAt(day: string): Date | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  const at = new Date(y, m - 1, d, 12);
  // A malformed day such as "2026-13-45" would roll over to another date: treat it as unknown.
  return localDay(at) === day ? at : null;
}

/**
 * Keeps the sample week ending yesterday when someone comes back on a later day: each sample
 * entry that is still there is moved to its new time and given a new rev, so a phone that
 * already synced it pulls the change like any other edit. Entries a viewer added, and sample
 * entries a viewer changed, stay as they are.
 */
export function refreshSampleWeek(s: DemoState, now: Date): DemoState {
  const today = localDay(now);
  if (s.sampleDay === today) return s;
  const account = s.accounts[DEMO_FAMILY_CODE];
  if (!account) return { ...s, sampleDay: today };
  let rev = account.rev;
  const fresh = new Map(sampleWeek(now).map((e) => [e.id, e]));
  // Where the sample week was laid out last time, so an entry the viewer edited is left alone.
  const before = s.sampleDay ? dayAt(s.sampleDay) : null;
  const laidOut = new Map((before ? sampleWeek(before) : []).map((e) => [e.id, e]));
  const matchesLayout = (e: LogEntry) => {
    const was = laidOut.get(e.id);
    return was?.startedAt === e.startedAt && was.durationSeconds === e.durationSeconds;
  };
  // If no live sample entry sits where the last layout says (a demo saved before sampleDay
  // existed, or the phone's time zone changed since), there is no usable record: move them all.
  // A viewer who moved every single sample entry looks the same and loses those edits; fine for a demo.
  const known = account.entries.some(
    (e) => fresh.has(e.id) && e.deletedAt === null && matchesLayout(e),
  );
  const entries = account.entries.map((e) => {
    const moved = fresh.get(e.id);
    if (!moved || e.deletedAt !== null) return e;
    if (known && !matchesLayout(e)) return e;
    rev += 1;
    return { ...e, startedAt: moved.startedAt, rev };
  });
  return {
    ...s,
    sampleDay: today,
    accounts: { ...s.accounts, [DEMO_FAMILY_CODE]: { ...account, rev, entries } },
  };
}

/**
 * Reads the saved demo, moving the sample week forward if the day changed. A moved week is saved
 * at once: otherwise the next visit would hand out the same rev numbers again with other times,
 * and a phone that already pulled them would never see the change. Exported for its unit test.
 */
export function loadState(now = new Date()): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as DemoState;
      const fresh = refreshSampleWeek(saved, now);
      if (fresh !== saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }
  } catch {
    // Storage blocked or unreadable: start fresh in memory.
  }
  return seed(now);
}

function seed(now = new Date()): DemoState {
  const entries = sampleWeek(now).map((e, i) => ({ ...e, rev: i + 1, deletedAt: null }));
  return {
    accounts: { [DEMO_FAMILY_CODE]: { pin: DEMO_PIN, rev: entries.length, entries } },
    session: null,
    sampleDay: localDay(now),
  };
}

let state: DemoState = loadState();

function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Kept in memory for this visit only.
  }
}

/** Puts the demo back to its starting point: the sample family only, signed out. */
export function resetDemoServer(): void {
  state = seed();
  save();
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

function fail(code: string, status: number, message: string): Response {
  return json({ error: { code, message } }, status);
}

/**
 * A made-up family code for the demo. Each character is drawn evenly: a random byte at or above
 * the largest multiple of the alphabet's length is thrown away and drawn again, so `% length`
 * makes no character likelier (the same thing Node's crypto.randomInt does for the real API).
 */
function newFamilyCode(): string {
  const n = FAMILY_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let code = "";
  while (code.length < FAMILY_CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(FAMILY_CODE_LENGTH))) {
      if (b < limit && code.length < FAMILY_CODE_LENGTH) code += FAMILY_CODE_ALPHABET.charAt(b % n);
    }
  }
  return code;
}

function readBody(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") return undefined;
  try {
    return JSON.parse(init.body) as unknown;
  } catch {
    return undefined;
  }
}

function signedInAccount(): DemoAccount | null {
  return state.session ? (state.accounts[state.session] ?? null) : null;
}

/** Answers one request the way apps/api would. Exported for its unit test. */
export function handle(method: string, url: URL, init?: RequestInit): Response {
  const path = url.pathname.replace(/^.*?\/api\//, "/api/");
  const body = readBody(init);

  if (path === "/api/health") return json({ ok: true });

  if (/^\/api\/auth\/(sign-up|sign-in)\/start$/.test(path) && method === "POST") {
    return json({ method: "family-code-pin" });
  }
  if (path === "/api/auth/sign-up/finish" && method === "POST") {
    const pin = (body as { pin?: unknown } | undefined)?.pin;
    if (typeof pin !== "string" || !/^[0-9]{6}$/.test(pin)) {
      return fail("weak_pin", 400, "Pick a different PIN.");
    }
    const code = newFamilyCode();
    state.accounts[code] = { pin, rev: 0, entries: [] };
    state.session = code;
    save();
    return json({ familyCode: code });
  }
  if (path === "/api/auth/sign-in/finish" && method === "POST") {
    const b = body as { familyCode?: unknown; pin?: unknown } | undefined;
    const code = typeof b?.familyCode === "string" ? normalizeFamilyCode(b.familyCode) : "";
    const account = state.accounts[code];
    if (!account || account.pin !== b?.pin) {
      return fail("sign_in_failed", 401, "That family code and PIN do not match.");
    }
    state.session = code;
    save();
    return json({ signedIn: true });
  }
  if (path === "/api/auth/sign-out" || path === "/api/auth/sign-out-everywhere") {
    state.session = null;
    save();
    return json({ signedOut: true });
  }

  const account = signedInAccount();
  if (path === "/api/me") {
    if (!account) return fail("unauthorized", 401, "Please sign in.");
    if (method === "DELETE") {
      const pin = (body as { pin?: unknown } | undefined)?.pin;
      if (pin !== account.pin) return fail("sign_in_failed", 401, "That PIN is not right.");
      const gone = state.session;
      state.accounts = Object.fromEntries(
        Object.entries(state.accounts).filter(([code]) => code !== gone),
      );
      state.session = null;
      save();
      return json({ deleted: true });
    }
    return json({ signedIn: true, phonesSignedIn: 1 });
  }

  if (path === "/api/logs" && method === "GET") {
    if (!account) return fail("unauthorized", 401, "Please sign in.");
    const query = logsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success) return fail("bad_request", 400, "Bad request.");
    const since = query.data.since ?? 0;
    const all = account.entries.filter((e) => e.rev > since).sort((a, b) => a.rev - b.rev);
    const newer = all.slice(0, LOG_PAGE_SIZE);
    // Same rule as the real API: the highest rev in this page, or `since` when it is empty.
    const latestRev = newer.at(-1)?.rev ?? since;
    return json({ entries: newer, latestRev, more: all.length > newer.length });
  }

  const logMatch = /^\/api\/logs\/([^/]+)$/.exec(path);
  if (logMatch?.[1]) {
    if (!account) return fail("unauthorized", 401, "Please sign in.");
    const idCheck = logIdSchema.safeParse(logMatch[1]);
    if (!idCheck.success) return fail("bad_request", 400, "Bad request.");
    const id = idCheck.data;
    const existing = account.entries.find((e) => e.id === id);
    if (method === "PUT") {
      const parsed = putLogBodySchema.safeParse(body);
      if (!parsed.success || !isAllowedStartTime(new Date(parsed.data.startedAt), new Date())) {
        return fail("bad_request", 400, "Check the time.");
      }
      account.rev += 1;
      const entry: LogEntry = { id, ...parsed.data, rev: account.rev, deletedAt: null };
      account.entries = [...account.entries.filter((e) => e.id !== id), entry];
      save();
      return json(entry);
    }
    if (method === "DELETE") {
      if (!existing) return fail("not_found", 404, "Not found.");
      account.rev += 1;
      const entry: LogEntry = {
        ...existing,
        rev: account.rev,
        deletedAt: new Date().toISOString(),
      };
      account.entries = [...account.entries.filter((e) => e.id !== id), entry];
      save();
      return json(entry);
    }
  }
  return fail("not_found", 404, "Not found.");
}

/** Sends every /api/ request on this page to handle() instead of the network. */
export function installDemoServer(): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (url.pathname.includes("/api/")) {
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      // A short wait so loading states show the way they would on a phone.
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(handle(method.toUpperCase(), url, init));
        }, 120);
      });
    }
    return realFetch(input, init);
  };
}
