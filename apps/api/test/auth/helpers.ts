import { randomBytes } from "node:crypto";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import type pg from "pg";
import { normalizeFamilyCode, type AuthMethod } from "@tummy/shared";
import { buildApp, type AppOptions } from "../../src/app.js";
import type { Clock } from "../../src/auth/clock.js";
import type { AuthSettings } from "../../src/auth/config.js";
import { codeLookup } from "../../src/auth/family-code.js";
import { createAuth } from "../../src/auth/index.js";
import { createPinHasher, type PinHasher } from "../../src/auth/pin-hash.js";
import { SESSION_COOKIE } from "../../src/auth/sessions.js";
import { openDb } from "../../src/db/client.js";
import type { AuthRateLimits } from "../../src/http/security.js";
import { appSettings, rawPool } from "../db/helpers.js";
import { SAME_SITE, TEST_ORIGIN } from "../same-site.js";

/** A made-up key for this test run only, from the secure random source. */
export const TEST_SECRET = randomBytes(32);

/** A clock the test moves by hand. Starts at the real time so stored rows look normal. */
export interface FakeClock extends Clock {
  advance(ms: number): void;
}
export function fakeClock(): FakeClock {
  let t = Date.now();
  return {
    now: () => new Date(t),
    advance(ms) {
      t += ms;
    },
  };
}

/** Wraps the real hasher and counts the Argon2id checks, so a test can see the work done. */
export interface CountingHasher extends PinHasher {
  counts: { verify: number; dummy: number };
}
let realHasher: Promise<PinHasher> | undefined;
async function countingHasher(): Promise<CountingHasher> {
  realHasher ??= createPinHasher();
  const real = await realHasher;
  const counts = { verify: 0, dummy: 0 };
  return {
    counts,
    hash: (pin) => real.hash(pin),
    verify(hash, pin) {
      counts.verify += 1;
      return real.verify(hash, pin);
    },
    verifyDummy(pin) {
      counts.dummy += 1;
      return real.verifyDummy(pin);
    },
  };
}

/** High enough that the tests' own requests never hit them. The real limits have their own test. */
export const GENEROUS_LIMITS: AuthRateLimits = {
  signIn: { max: 10_000, timeWindowMs: 60_000 },
  signUp: { max: 10_000, timeWindowMs: 60_000 },
};

export interface AuthTestApp {
  app: FastifyInstance;
  clock: FakeClock;
  hasher: CountingHasher;
  raw: pg.Pool;
  /** Account IDs made through this app; removed by close(). */
  made: string[];
  close(): Promise<void>;
}

export async function authTestApp(
  options: {
    provider?: AuthMethod;
    rateLimits?: AuthRateLimits;
    app?: Partial<AppOptions>;
  } = {},
): Promise<AuthTestApp> {
  const startedAt = new Date();
  const handle = openDb(appSettings());
  const raw = rawPool(appSettings());
  const clock = fakeClock();
  const hasher = await countingHasher();
  const settings: AuthSettings = {
    provider: options.provider ?? "family-code-pin",
    codeLookupSecret: TEST_SECRET,
    appOrigin: TEST_ORIGIN,
    nodeEnv: "test",
  };
  const auth = await createAuth({
    db: handle.db,
    settings,
    clock,
    hasher,
    rateLimits: options.rateLimits ?? GENEROUS_LIMITS,
  });
  const app = buildApp({ db: handle, appOrigin: TEST_ORIGIN, auth, ...options.app });
  const made: string[] = [];
  return {
    app,
    clock,
    hasher,
    raw,
    made,
    async close() {
      await app.close();
      if (made.length > 0) {
        await raw.query("DELETE FROM audit_events WHERE account_id = ANY($1::uuid[])", [made]);
        await raw.query("DELETE FROM accounts WHERE id = ANY($1::uuid[])", [made]);
      }
      // Failed sign-ins for unknown codes, and events of deleted accounts, have no account.
      // Only this run's are removed: the database is shared with development.
      await raw.query("DELETE FROM audit_events WHERE account_id IS NULL AND created_at >= $1", [
        startedAt,
      ]);
      await raw.end();
    },
  };
}

/** The session token from a Set-Cookie answer, or undefined when none was set. */
export function sessionToken(res: LightMyRequestResponse): string | undefined {
  const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
  return cookie && cookie.value !== "" ? cookie.value : undefined;
}

export function cookieHeader(token: string): { cookie: string } {
  return { cookie: `${SESSION_COOKIE}=${token}` };
}

/** The account a family code belongs to, read straight from the database. */
export async function accountIdFor(raw: pg.Pool, familyCode: string): Promise<string | undefined> {
  const { rows } = await raw.query<{ id: string }>(
    "SELECT id FROM accounts WHERE code_lookup = $1",
    [codeLookup(TEST_SECRET, normalizeFamilyCode(familyCode))],
  );
  return rows[0]?.id;
}

export interface SignedUp {
  familyCode: string;
  token: string;
  accountId: string;
  pin: string;
}

/** A PIN that passes the common-PIN rules, different each call. */
let pinCounter = 0;
export function okPin(): string {
  const base = [482916, 730518, 261947, 593082, 847361, 315790, 908246, 674153];
  pinCounter += 1;
  return String(base[pinCounter % base.length]);
}

export async function signUp(t: AuthTestApp, pin = okPin()): Promise<SignedUp> {
  const res = await t.app.inject({
    method: "POST",
    url: "/api/auth/sign-up/finish",
    headers: SAME_SITE,
    payload: { pin },
  });
  if (res.statusCode !== 201) {
    throw new Error(`sign-up failed: ${String(res.statusCode)} ${res.body}`);
  }
  const familyCode = res.json<{ familyCode: string }>().familyCode;
  const token = sessionToken(res);
  const accountId = await accountIdFor(t.raw, familyCode);
  if (token === undefined || accountId === undefined) {
    throw new Error("sign-up set no session or made no account");
  }
  t.made.push(accountId);
  return { familyCode, token, accountId, pin };
}

export function signIn(
  t: AuthTestApp,
  familyCode: string,
  pin: string,
  extraHeaders: Record<string, string> = {},
): Promise<LightMyRequestResponse> {
  return t.app.inject({
    method: "POST",
    url: "/api/auth/sign-in/finish",
    headers: { ...SAME_SITE, ...extraHeaders },
    payload: { familyCode, pin },
  });
}

export function me(t: AuthTestApp, token: string): Promise<LightMyRequestResponse> {
  return t.app.inject({ method: "GET", url: "/api/me", headers: cookieHeader(token) });
}

export async function accountRow(
  raw: pg.Pool,
  id: string,
): Promise<{ failed_attempts: number; locked_until: Date | null } | undefined> {
  const { rows } = await raw.query<{ failed_attempts: number; locked_until: Date | null }>(
    "SELECT failed_attempts, locked_until FROM accounts WHERE id = $1",
    [id],
  );
  return rows[0];
}

export async function auditTypes(raw: pg.Pool, id: string): Promise<string[]> {
  const { rows } = await raw.query<{ type: string }>(
    "SELECT type FROM audit_events WHERE account_id = $1 ORDER BY created_at, type",
    [id],
  );
  return rows.map((r) => r.type);
}
