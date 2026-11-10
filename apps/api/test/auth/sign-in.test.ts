import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  apiErrorSchema,
  FAMILY_CODE_ALPHABET,
  isWellFormedFamilyCode,
  normalizeFamilyCode,
  signUpFinishResponseSchema,
} from "@tummy/shared";
import { codeLookup } from "../../src/auth/family-code.js";
import { LOCK_DURATION_MS, MAX_FAILED_ATTEMPTS } from "../../src/auth/pin-check.js";
import { SAME_SITE } from "../same-site.js";
import {
  accountIdFor,
  accountRow,
  auditTypes,
  authTestApp,
  me,
  okPin,
  sessionToken,
  signIn,
  signUp,
  TEST_SECRET,
  type AuthTestApp,
} from "./helpers.js";

/** A well-formed family code that no account has (the chance of a clash is about 1 in 2^59). */
function unknownCode(): string {
  let code = "";
  for (let i = 0; i < 12; i += 1) {
    code += FAMILY_CODE_ALPHABET.charAt(Math.floor(Math.random() * FAMILY_CODE_ALPHABET.length));
  }
  return code;
}

function wrongPin(pin: string): string {
  return pin === "482916" ? "730518" : "482916";
}

let t: AuthTestApp;
beforeAll(async () => {
  t = await authTestApp();
});
afterAll(async () => {
  await t.close();
});

describe("sign-up", () => {
  it("makes an account, shows the family code once as three groups of four, and signs in", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/finish",
      headers: SAME_SITE,
      payload: { pin: okPin() },
    });
    expect(res.statusCode).toBe(201);
    const body = signUpFinishResponseSchema.parse(res.json());
    const groups = body.familyCode.split(" ");
    expect(groups.map((g) => g.length)).toEqual([4, 4, 4]);
    expect(isWellFormedFamilyCode(groups.join(""))).toBe(true);
    const token = sessionToken(res);
    expect(token).toBeDefined();
    expect((await me(t, token ?? "")).statusCode).toBe(200);

    const code = normalizeFamilyCode(body.familyCode);
    const id = await accountIdFor(t.raw, body.familyCode);
    expect(id).toBeDefined();
    if (id) t.made.push(id);
    // Nothing readable is stored: the code only as its keyed hash, the PIN only as Argon2id.
    const { rows } = await t.raw.query<{ code_lookup: string; pin_hash: string }>(
      "SELECT code_lookup, pin_hash FROM accounts WHERE id = $1",
      [id],
    );
    expect(rows[0]?.code_lookup).toBe(codeLookup(TEST_SECRET, code));
    expect(rows[0]?.code_lookup).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.pin_hash).toMatch(/^\$argon2id\$v=19\$m=47104,/);
    expect(await auditTypes(t.raw, id ?? "")).toEqual(["sign_up"]);
  });

  it("each sign-up gets a different code", async () => {
    const a = await signUp(t);
    const b = await signUp(t);
    expect(a.familyCode).not.toBe(b.familyCode);
  });

  it.each(["123456", "000000", "121212", "123123", "654321", "112233", "890123"])(
    "refuses the common PIN %s and makes no account",
    async (pin) => {
      const before = await t.raw.query("SELECT count(*)::int AS n FROM accounts");
      const res = await t.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/finish",
        headers: SAME_SITE,
        payload: { pin },
      });
      expect(res.statusCode).toBe(400);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe("weak_pin");
      expect(sessionToken(res)).toBeUndefined();
      const after = await t.raw.query("SELECT count(*)::int AS n FROM accounts");
      expect(after.rows[0]).toEqual(before.rows[0]);
    },
  );

  it.each([{ pin: "12345" }, { pin: "1234567" }, { pin: 482916 }, { pin: "48291a" }, {}])(
    "refuses a malformed request %j",
    async (payload) => {
      const res = await t.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/finish",
        headers: SAME_SITE,
        payload,
      });
      expect(res.statusCode).toBe(400);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe("bad_request");
    },
  );

  it("the start steps say which method this server uses", async () => {
    for (const url of ["/api/auth/sign-up/start", "/api/auth/sign-in/start"]) {
      const res = await t.app.inject({ method: "POST", url, headers: SAME_SITE });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ method: "family-code-pin" });
    }
  });
});

describe("sign-in", () => {
  it("signs in with the code and PIN, with or without spaces, dashes and capitals", async () => {
    const acct = await signUp(t);
    const plain = normalizeFamilyCode(acct.familyCode);
    const dashed = `${plain.slice(0, 4)}-${plain.slice(4, 8)}-${plain.slice(8)}`.toLowerCase();
    for (const typed of [acct.familyCode, plain, dashed, ` ${dashed} `]) {
      const res = await signIn(t, typed, acct.pin);
      expect(res.statusCode, typed).toBe(200);
      expect(res.json()).toEqual({ signedIn: true });
      const token = sessionToken(res);
      expect(token).toBeDefined();
      expect(token).not.toBe(acct.token);
      expect((await me(t, token ?? "")).statusCode).toBe(200);
    }
    expect((await auditTypes(t.raw, acct.accountId)).filter((x) => x === "sign_in")).toHaveLength(
      4,
    );
  });

  it("a wrong PIN is refused, sets no cookie, and is counted and recorded", async () => {
    const acct = await signUp(t);
    const res = await signIn(t, acct.familyCode, wrongPin(acct.pin));
    expect(res.statusCode).toBe(401);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe("sign_in_failed");
    expect(sessionToken(res)).toBeUndefined();
    expect((await accountRow(t.raw, acct.accountId))?.failed_attempts).toBe(1);
    expect(await auditTypes(t.raw, acct.accountId)).toContain("sign_in_failed");
  });

  it("a right PIN clears the count of wrong ones", async () => {
    const acct = await signUp(t);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i += 1) {
      expect((await signIn(t, acct.familyCode, wrongPin(acct.pin))).statusCode).toBe(401);
    }
    expect((await accountRow(t.raw, acct.accountId))?.failed_attempts).toBe(4);
    expect((await signIn(t, acct.familyCode, acct.pin)).statusCode).toBe(200);
    expect(await accountRow(t.raw, acct.accountId)).toEqual({
      failed_attempts: 0,
      locked_until: null,
    });
  });
});

describe("an unknown code and a wrong PIN look the same (threat model #2)", () => {
  it("same status, same body, same headers that matter, no cookie", async () => {
    const acct = await signUp(t);
    const wrong = await signIn(t, acct.familyCode, wrongPin(acct.pin));
    const unknown = await signIn(t, unknownCode(), acct.pin);
    const malformed = await signIn(t, "NOT-A-REAL-CODE", acct.pin);
    for (const res of [unknown, malformed]) {
      expect(res.statusCode).toBe(wrong.statusCode);
      expect(res.body).toBe(wrong.body);
      expect(res.headers["content-type"]).toBe(wrong.headers["content-type"]);
      expect(res.headers["content-length"]).toBe(wrong.headers["content-length"]);
      expect(res.headers["set-cookie"]).toBeUndefined();
    }
    expect(wrong.headers["set-cookie"]).toBeUndefined();
  });

  it("an unknown code still runs one full Argon2id check, against the dummy hash", async () => {
    const before = { ...t.hasher.counts };
    await signIn(t, unknownCode(), "482916");
    expect(t.hasher.counts.dummy - before.dummy).toBe(1);
    expect(t.hasher.counts.verify - before.verify).toBe(0);

    const acct = await signUp(t);
    const mid = { ...t.hasher.counts };
    await signIn(t, acct.familyCode, wrongPin(acct.pin));
    expect(t.hasher.counts.verify - mid.verify).toBe(1);
    expect(t.hasher.counts.dummy - mid.dummy).toBe(0);
  });

  it("an unknown code is recorded as a failed sign-in with no account", async () => {
    const before = await t.raw.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE account_id IS NULL AND type = 'sign_in_failed'",
    );
    await signIn(t, unknownCode(), "482916");
    const after = await t.raw.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE account_id IS NULL AND type = 'sign_in_failed'",
    );
    expect((after.rows[0]?.n ?? 0) - (before.rows[0]?.n ?? 0)).toBe(1);
  });

  it("takes about the same time (medians of several tries, generous tolerance)", async () => {
    // Two accounts, three wrong PINs each, so neither reaches the lockout.
    const accts = [await signUp(t), await signUp(t)];
    const time = async (run: () => Promise<unknown>) => {
      const start = performance.now();
      await run();
      return performance.now() - start;
    };
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
    const wrong: number[] = [];
    const unknown: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const acct = accts[i % 2];
      if (!acct) throw new Error("no account");
      wrong.push(await time(() => signIn(t, acct.familyCode, wrongPin(acct.pin))));
      unknown.push(await time(() => signIn(t, unknownCode(), acct.pin)));
    }
    const ratio = median(unknown) / median(wrong);
    // Both are dominated by one Argon2id check (tens of ms). Without the dummy check the
    // unknown path would take a few ms, a ratio near 0.05, far outside this band.
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });
});

describe("lockout", () => {
  it("5 wrong PINs lock the account; the right PIN is then refused; it opens again after 15 minutes", async () => {
    const acct = await signUp(t);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      const res = await signIn(t, acct.familyCode, wrongPin(acct.pin));
      expect(res.statusCode).toBe(401);
    }
    const row = await accountRow(t.raw, acct.accountId);
    expect(row?.failed_attempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(row?.locked_until?.getTime()).toBe(t.clock.now().getTime() + LOCK_DURATION_MS);
    expect(await auditTypes(t.raw, acct.accountId)).toContain("lockout");

    // Locked: even the right PIN is refused, with the distinct "locked" answer.
    const locked = await signIn(t, acct.familyCode, acct.pin);
    expect(locked.statusCode).toBe(429);
    expect(apiErrorSchema.parse(locked.json()).error.code).toBe("account_locked");
    expect(sessionToken(locked)).toBeUndefined();

    // One second before the end: still locked. No PIN is even checked.
    t.clock.advance(LOCK_DURATION_MS - 1000);
    const checks = t.hasher.counts.verify;
    expect((await signIn(t, acct.familyCode, acct.pin)).statusCode).toBe(429);
    expect(t.hasher.counts.verify).toBe(checks);

    // After the 15 minutes: the right PIN works and the count starts again.
    t.clock.advance(1000);
    const open = await signIn(t, acct.familyCode, acct.pin);
    expect(open.statusCode).toBe(200);
    expect(await accountRow(t.raw, acct.accountId)).toEqual({
      failed_attempts: 0,
      locked_until: null,
    });
  });

  it("after a lock ends, a wrong PIN starts a new count at 1", async () => {
    const acct = await signUp(t);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) {
      await signIn(t, acct.familyCode, wrongPin(acct.pin));
    }
    t.clock.advance(LOCK_DURATION_MS);
    expect((await signIn(t, acct.familyCode, wrongPin(acct.pin))).statusCode).toBe(401);
    expect(await accountRow(t.raw, acct.accountId)).toEqual({
      failed_attempts: 1,
      locked_until: null,
    });
  });

  it("20 wrong PINs sent at once: exactly 5 are checked, the rest are refused as locked", async () => {
    const acct = await signUp(t);
    const checks = t.hasher.counts.verify;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => signIn(t, acct.familyCode, wrongPin(acct.pin))),
    );
    const codes = results.map((r) => apiErrorSchema.parse(r.json()).error.code);
    expect(codes.filter((c) => c === "sign_in_failed")).toHaveLength(MAX_FAILED_ATTEMPTS);
    expect(codes.filter((c) => c === "account_locked")).toHaveLength(20 - MAX_FAILED_ATTEMPTS);
    expect(t.hasher.counts.verify - checks).toBe(MAX_FAILED_ATTEMPTS);
    const row = await accountRow(t.raw, acct.accountId);
    expect(row?.failed_attempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(row?.locked_until).not.toBeNull();
    expect((await auditTypes(t.raw, acct.accountId)).filter((x) => x === "lockout")).toHaveLength(
      1,
    );
  });

  it("an unknown code never gets the locked answer, however often it is tried", async () => {
    const code = unknownCode();
    const results = await Promise.all(Array.from({ length: 12 }, () => signIn(t, code, "482916")));
    for (const res of results) {
      expect(res.statusCode).toBe(401);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe("sign_in_failed");
    }
  });
});

describe("rate limits per network address (in memory only)", () => {
  let limited: AuthTestApp;
  beforeAll(async () => {
    limited = await authTestApp({
      rateLimits: {
        signIn: { max: 3, timeWindowMs: 60_000 },
        signUp: { max: 2, timeWindowMs: 60_000 },
      },
    });
  });
  afterAll(async () => {
    await limited.close();
  });

  it("sign-in answers 429 rate_limited after its limit, from that address only", async () => {
    const send = (remoteAddress: string) =>
      limited.app.inject({
        method: "POST",
        url: "/api/auth/sign-in/finish",
        headers: SAME_SITE,
        remoteAddress,
        payload: { familyCode: unknownCode(), pin: "482916" },
      });
    for (let i = 0; i < 3; i += 1) expect((await send("198.51.100.7")).statusCode).toBe(401);
    const res = await send("198.51.100.7");
    expect(res.statusCode).toBe(429);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe("rate_limited");
    expect((await send("198.51.100.8")).statusCode).toBe(401);
  });

  it("sign-up answers 429 after its limit", async () => {
    const send = () =>
      limited.app.inject({
        method: "POST",
        url: "/api/auth/sign-up/finish",
        headers: SAME_SITE,
        remoteAddress: "198.51.100.9",
        payload: { pin: "123456" },
      });
    expect((await send()).statusCode).toBe(400);
    expect((await send()).statusCode).toBe(400);
    expect((await send()).statusCode).toBe(429);
  });

  it("the real limits are stricter than the general one", async () => {
    const { DEFAULT_AUTH_RATE_LIMITS, DEFAULT_RATE_LIMIT } =
      await import("../../src/http/security.js");
    const perMinute = (l: { max: number; timeWindowMs: number }) =>
      (l.max * 60_000) / l.timeWindowMs;
    expect(perMinute(DEFAULT_AUTH_RATE_LIMITS.signIn)).toBeLessThan(perMinute(DEFAULT_RATE_LIMIT));
    expect(perMinute(DEFAULT_AUTH_RATE_LIMITS.signUp)).toBeLessThan(perMinute(DEFAULT_RATE_LIMIT));
    expect(DEFAULT_AUTH_RATE_LIMITS.signIn).toEqual({ max: 10, timeWindowMs: 60_000 });
    expect(DEFAULT_AUTH_RATE_LIMITS.signUp).toEqual({ max: 20, timeWindowMs: 3_600_000 });
  });
});
