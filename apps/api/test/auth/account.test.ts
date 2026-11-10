import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiErrorSchema, meResponseSchema } from "@tummy/shared";
import { forAccount, toAccountId } from "../../src/db/account-scope.js";
import { openDb } from "../../src/db/client.js";
import { MAX_FAILED_ATTEMPTS } from "../../src/auth/pin-check.js";
import { appSettings } from "../db/helpers.js";
import { SAME_SITE } from "../same-site.js";
import {
  accountRow,
  auditTypes,
  authTestApp,
  cookieHeader,
  me,
  sessionToken,
  signIn,
  signUp,
  type AuthTestApp,
} from "./helpers.js";

let t: AuthTestApp;
const handle = openDb(appSettings());
beforeAll(async () => {
  t = await authTestApp();
});
afterAll(async () => {
  await t.close();
  await handle.close();
});

function deleteMe(token: string, pin: string) {
  return t.app.inject({
    method: "DELETE",
    url: "/api/me",
    headers: { ...SAME_SITE, ...cookieHeader(token) },
    payload: { pin },
  });
}

async function counts(accountId: string) {
  const q = async (sql: string) =>
    (await t.raw.query<{ n: number }>(sql, [accountId])).rows[0]?.n ?? -1;
  return {
    accounts: await q("SELECT count(*)::int AS n FROM accounts WHERE id = $1"),
    sessions: await q("SELECT count(*)::int AS n FROM sessions WHERE account_id = $1"),
    logs: await q("SELECT count(*)::int AS n FROM tummy_logs WHERE account_id = $1"),
    audit: await q("SELECT count(*)::int AS n FROM audit_events WHERE account_id = $1"),
  };
}

async function addLogs(accountId: string, n: number) {
  const scope = forAccount(handle.db, toAccountId(accountId));
  for (let i = 0; i < n; i += 1) {
    await scope.logs.insert({ id: randomUUID(), startedAt: new Date(), durationSeconds: 60 + i });
  }
}

describe("GET /api/me", () => {
  it("returns only what the screens need: no IDs, hashes or counters", async () => {
    const acct = await signUp(t);
    const res = await me(t, acct.token);
    expect(res.statusCode).toBe(200);
    expect(meResponseSchema.parse(res.json())).toEqual({ signedIn: true, phonesSignedIn: 1 });
    expect(res.body).not.toContain(acct.accountId);
    expect(res.body).not.toMatch(/hash|attempt|lock|argon|[0-9a-f]{64}/i);
  });

  it("answers 401 with no session", async () => {
    const res = await t.app.inject({ method: "GET", url: "/api/me" });
    expect(res.statusCode).toBe(401);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe("unauthorized");
  });
});

describe("DELETE /api/me", () => {
  it("with the PIN: removes the account, every session and every log for good, in one go", async () => {
    const acct = await signUp(t);
    const second = sessionToken(await signIn(t, acct.familyCode, acct.pin)) ?? "";
    await addLogs(acct.accountId, 3);
    expect(await counts(acct.accountId)).toMatchObject({ accounts: 1, sessions: 2, logs: 3 });

    const res = await deleteMe(acct.token, acct.pin);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ deleted: true });
    expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");

    expect(await counts(acct.accountId)).toEqual({ accounts: 0, sessions: 0, logs: 0, audit: 0 });
    expect((await me(t, acct.token)).statusCode).toBe(401);
    expect((await me(t, second)).statusCode).toBe(401);
    // The code no longer signs in.
    expect((await signIn(t, acct.familyCode, acct.pin)).statusCode).toBe(401);
    // The audit trail keeps an account_deleted event with no account attached.
    const { rows } = await t.raw.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_events WHERE account_id IS NULL AND type = 'account_deleted' AND created_at > now() - interval '1 minute'",
    );
    expect(rows[0]?.n).toBeGreaterThan(0);
  });

  it("with a wrong PIN: nothing is deleted, the attempt counts toward the lockout", async () => {
    const acct = await signUp(t);
    await addLogs(acct.accountId, 1);
    const wrong = acct.pin === "482916" ? "730518" : "482916";
    const res = await deleteMe(acct.token, wrong);
    expect(res.statusCode).toBe(401);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe("sign_in_failed");
    expect(await counts(acct.accountId)).toMatchObject({ accounts: 1, sessions: 1, logs: 1 });
    expect((await accountRow(t.raw, acct.accountId))?.failed_attempts).toBe(1);
    expect((await me(t, acct.token)).statusCode).toBe(200);
  });

  it("is refused while the account is locked, even with the right PIN", async () => {
    const acct = await signUp(t);
    const wrong = acct.pin === "482916" ? "730518" : "482916";
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i += 1) await deleteMe(acct.token, wrong);
    const res = await deleteMe(acct.token, acct.pin);
    expect(res.statusCode).toBe(429);
    expect(apiErrorSchema.parse(res.json()).error.code).toBe("account_locked");
    expect((await counts(acct.accountId)).accounts).toBe(1);
  });

  it("needs a session and a PIN", async () => {
    const acct = await signUp(t);
    expect(
      (
        await t.app.inject({
          method: "DELETE",
          url: "/api/me",
          headers: SAME_SITE,
          payload: { pin: acct.pin },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await t.app.inject({
          method: "DELETE",
          url: "/api/me",
          headers: { ...SAME_SITE, ...cookieHeader(acct.token) },
          payload: {},
        })
      ).statusCode,
    ).toBe(400);
  });
});

describe("one account cannot read or change another's data", () => {
  it("phones, sign-out everywhere, deletion and audit events stay with their own account", async () => {
    const a = await signUp(t, "482916");
    const b = await signUp(t, "730518");
    const a2 = sessionToken(await signIn(t, a.familyCode, a.pin)) ?? "";
    await addLogs(b.accountId, 2);

    // Each sees only its own phones.
    expect((await me(t, a.token)).json()).toEqual({ signedIn: true, phonesSignedIn: 2 });
    expect((await me(t, b.token)).json()).toEqual({ signedIn: true, phonesSignedIn: 1 });

    // A's "sign out everywhere" ends only A's sessions.
    await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-out-everywhere",
      headers: { ...SAME_SITE, ...cookieHeader(a2) },
    });
    expect((await me(t, a.token)).statusCode).toBe(401);
    expect((await me(t, b.token)).statusCode).toBe(200);

    // B's session with A's PIN deletes nothing: the PIN is checked against B, and A is untouched.
    expect((await deleteMe(b.token, a.pin)).statusCode).toBe(401);
    expect((await counts(a.accountId)).accounts).toBe(1);
    expect((await counts(b.accountId)).accounts).toBe(1);
    expect((await accountRow(t.raw, a.accountId))?.failed_attempts).toBe(0);

    const c = await signUp(t, "261947");

    // Deleting C leaves B's rows alone.
    expect((await deleteMe(c.token, c.pin)).statusCode).toBe(200);
    expect(await counts(b.accountId)).toMatchObject({ accounts: 1, sessions: 1, logs: 2 });

    // Each account's audit events are its own.
    const aEvents = await auditTypes(t.raw, a.accountId);
    const bEvents = await auditTypes(t.raw, b.accountId);
    expect(aEvents).toContain("sign_out");
    expect(bEvents).not.toContain("sign_out");
    const scopedB = await forAccount(handle.db, toAccountId(b.accountId)).audit.list();
    expect(scopedB.every((e) => e.accountId === b.accountId)).toBe(true);
  });
});
