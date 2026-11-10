import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiErrorSchema } from "@tummy/shared";
import {
  ABSOLUTE_LIMIT_MS,
  IDLE_LIMIT_MS,
  SESSION_COOKIE,
  sessionIdHash,
  TOUCH_INTERVAL_MS,
} from "../../src/auth/sessions.js";
import { SAME_SITE } from "../same-site.js";
import {
  auditTypes,
  authTestApp,
  cookieHeader,
  me,
  sessionToken,
  signIn,
  signUp,
  type AuthTestApp,
} from "./helpers.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let t: AuthTestApp;
beforeAll(async () => {
  t = await authTestApp();
});
afterAll(async () => {
  await t.close();
});

async function sessionRow(token: string) {
  const { rows } = await t.raw.query<{
    account_id: string;
    created_at: Date;
    last_seen_at: Date;
    expires_at: Date;
  }>("SELECT account_id, created_at, last_seen_at, expires_at FROM sessions WHERE id_hash = $1", [
    sessionIdHash(token),
  ]);
  return rows[0];
}

describe("the session cookie", () => {
  it("is __Host-, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain, and lasts at most 90 days", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/finish",
      headers: SAME_SITE,
      payload: { pin: "482916" },
    });
    const header = String(res.headers["set-cookie"]);
    const [pair, ...attributes] = header.split("; ");
    expect(pair?.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(pair?.slice(SESSION_COOKIE.length + 1)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(SESSION_COOKIE.startsWith("__Host-")).toBe(true);
    expect(attributes.sort()).toEqual(
      ["HttpOnly", "Max-Age=7776000", "Path=/", "SameSite=Lax", "Secure"].sort(),
    );
    expect(header).not.toMatch(/Domain=/i);
    const token = sessionToken(res) ?? "";
    // The token itself is never stored: only its SHA-256 hash.
    const { rows } = await t.raw.query<{ id_hash: string; account_id: string }>(
      "SELECT id_hash, account_id FROM sessions WHERE id_hash = $1",
      [sessionIdHash(token)],
    );
    expect(rows[0]?.id_hash).toMatch(/^[0-9a-f]{64}$/);
    const raw = await t.raw.query("SELECT 1 FROM sessions WHERE id_hash = $1", [token]);
    expect(raw.rowCount).toBe(0);
    if (rows[0]) t.made.push(rows[0].account_id);
  });

  it("the token is 256 random bits and differs every time", async () => {
    const tokens = new Set<string>();
    const acct = await signUp(t);
    for (let i = 0; i < 5; i += 1) {
      tokens.add(sessionToken(await signIn(t, acct.familyCode, acct.pin)) ?? "");
    }
    expect(tokens.size).toBe(5);
    for (const token of tokens) {
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
    }
  });

  it("stores 90 days as expires_at", async () => {
    const acct = await signUp(t);
    const row = await sessionRow(acct.token);
    expect(row?.expires_at.getTime()).toBe((row?.created_at.getTime() ?? 0) + ABSOLUTE_LIMIT_MS);
    expect(row?.last_seen_at.getTime()).toBe(row?.created_at.getTime());
  });

  it("a request without a session, or with a made-up one, is not signed in", async () => {
    expect((await t.app.inject({ method: "GET", url: "/api/me" })).statusCode).toBe(401);
    for (const value of ["nonsense", "A".repeat(43), "", "x".repeat(500)]) {
      const res = await me(t, value);
      expect(res.statusCode).toBe(401);
      expect(apiErrorSchema.parse(res.json()).error.code).toBe("unauthorized");
    }
  });
});

describe("expiry", () => {
  it("30 days unused: treated as absent and deleted", async () => {
    const acct = await signUp(t);
    t.clock.advance(IDLE_LIMIT_MS - 1000);
    // Just inside the limit: still signed in (and this use counts, so move on from here).
    expect((await me(t, acct.token)).statusCode).toBe(200);
    t.clock.advance(IDLE_LIMIT_MS);
    expect((await me(t, acct.token)).statusCode).toBe(401);
    expect(await sessionRow(acct.token)).toBeUndefined();
  });

  it("90 days after sign-in it ends even if used every day", async () => {
    const acct = await signUp(t);
    for (let day = 1; day < 90; day += 1) {
      t.clock.advance(DAY);
      expect((await me(t, acct.token)).statusCode, `day ${String(day)}`).toBe(200);
    }
    t.clock.advance(DAY);
    expect((await me(t, acct.token)).statusCode).toBe(401);
    expect(await sessionRow(acct.token)).toBeUndefined();
  });

  it("last_seen_at is written at most about once an hour", async () => {
    const acct = await signUp(t);
    const first = (await sessionRow(acct.token))?.last_seen_at.getTime();
    t.clock.advance(30 * 60 * 1000);
    await me(t, acct.token);
    expect((await sessionRow(acct.token))?.last_seen_at.getTime()).toBe(first);
    t.clock.advance(TOUCH_INTERVAL_MS);
    await me(t, acct.token);
    expect((await sessionRow(acct.token))?.last_seen_at.getTime()).toBe(t.clock.now().getTime());
  });
});

describe("two phones, sign-out and sign-out everywhere", () => {
  it("signing out on one phone leaves the other signed in", async () => {
    const acct = await signUp(t);
    const second = sessionToken(await signIn(t, acct.familyCode, acct.pin)) ?? "";
    expect((await me(t, acct.token)).json()).toEqual({ signedIn: true, phonesSignedIn: 2 });

    const out = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { ...SAME_SITE, ...cookieHeader(acct.token) },
    });
    expect(out.statusCode).toBe(200);
    expect(out.json()).toEqual({ signedOut: true });
    // The cookie is cleared, with the same attributes so the browser matches it.
    const cleared = String(out.headers["set-cookie"]);
    expect(cleared.startsWith(`${SESSION_COOKIE}=;`)).toBe(true);
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("Path=/");
    expect(cleared).toContain("Secure");
    expect(cleared).toContain("HttpOnly");

    expect((await me(t, acct.token)).statusCode).toBe(401);
    expect((await me(t, second)).json()).toEqual({ signedIn: true, phonesSignedIn: 1 });
    expect(await auditTypes(t.raw, acct.accountId)).toContain("sign_out");
  });

  it("sign out everywhere ends every phone of that account", async () => {
    const acct = await signUp(t);
    const second = sessionToken(await signIn(t, acct.familyCode, acct.pin)) ?? "";
    const third = sessionToken(await signIn(t, acct.familyCode, acct.pin)) ?? "";
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-out-everywhere",
      headers: { ...SAME_SITE, ...cookieHeader(second) },
    });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");
    for (const token of [acct.token, second, third]) {
      expect((await me(t, token)).statusCode).toBe(401);
    }
    const { rows } = await t.raw.query("SELECT 1 FROM sessions WHERE account_id = $1", [
      acct.accountId,
    ]);
    expect(rows).toHaveLength(0);
  });

  it("sign out everywhere needs a session", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-out-everywhere",
      headers: SAME_SITE,
    });
    expect(res.statusCode).toBe(401);
  });

  it("sign out without a session still clears the cookie", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { ...SAME_SITE, ...cookieHeader("A".repeat(43)) },
    });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");
  });
});

describe("no session fixation", () => {
  it("signing in ends the session the browser already had, even another account's", async () => {
    const other = await signUp(t);
    const acct = await signUp(t);
    const res = await signIn(t, acct.familyCode, acct.pin, cookieHeader(other.token));
    expect(res.statusCode).toBe(200);
    const fresh = sessionToken(res) ?? "";
    expect(fresh).not.toBe(other.token);
    expect((await me(t, other.token)).statusCode).toBe(401);
    expect((await me(t, fresh)).statusCode).toBe(200);
  });

  it("signing up does the same", async () => {
    const before = await signUp(t);
    const res = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-up/finish",
      headers: { ...SAME_SITE, ...cookieHeader(before.token) },
      payload: { pin: "730518" },
    });
    expect(res.statusCode).toBe(201);
    expect((await me(t, before.token)).statusCode).toBe(401);
    const row = await t.raw.query<{ account_id: string }>(
      "SELECT account_id FROM sessions WHERE id_hash = $1",
      [sessionIdHash(sessionToken(res) ?? "")],
    );
    if (row.rows[0]) t.made.push(row.rows[0].account_id);
  });

  it("a failed sign-in leaves an existing session alone", async () => {
    const acct = await signUp(t);
    const res = await signIn(t, acct.familyCode, acct.pin === "482916" ? "730518" : "482916", {
      ...cookieHeader(acct.token),
    });
    expect(res.statusCode).toBe(401);
    expect((await me(t, acct.token)).statusCode).toBe(200);
  });
});
