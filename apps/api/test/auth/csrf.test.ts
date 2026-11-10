import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiErrorSchema } from "@tummy/shared";
import { buildApp } from "../../src/app.js";
import { TEST_ORIGIN } from "../same-site.js";
import {
  accountRow,
  authTestApp,
  cookieHeader,
  me,
  signUp,
  type AuthTestApp,
  type SignedUp,
} from "./helpers.js";

/**
 * Threat model #5: another site must not be able to make a signed-in phone change anything.
 * Every state-changing route, sign-in and sign-up included, is refused with 403 when the Origin
 * is missing or foreign, or the custom header is missing, and it is refused before any work.
 */

let t: AuthTestApp;
let acct: SignedUp;
beforeAll(async () => {
  t = await authTestApp();
  acct = await signUp(t);
});
afterAll(async () => {
  await t.close();
});

const routes = (pin: string, code: string) =>
  [
    { method: "POST", url: "/api/auth/sign-up/start" },
    { method: "POST", url: "/api/auth/sign-up/finish", payload: { pin: "593082" } },
    { method: "POST", url: "/api/auth/sign-in/start" },
    {
      method: "POST",
      url: "/api/auth/sign-in/finish",
      payload: { familyCode: code, pin: "000001" },
    },
    { method: "POST", url: "/api/auth/sign-out" },
    { method: "POST", url: "/api/auth/sign-out-everywhere" },
    { method: "DELETE", url: "/api/me", payload: { pin } },
    // Unknown addresses are refused the same way, before the 404.
    { method: "POST", url: "/api/nothing-here", payload: { a: 1 } },
    { method: "PUT", url: "/api/me", payload: { a: 1 } },
  ] as const;

const badHeaders: [string, Record<string, string>][] = [
  ["a foreign Origin", { origin: "https://evil.example", "x-tummy-request": "1" }],
  ["a look-alike Origin", { origin: `${TEST_ORIGIN}.evil.example`, "x-tummy-request": "1" }],
  [
    "the right host on another scheme",
    { origin: TEST_ORIGIN.replace("http:", "https:"), "x-tummy-request": "1" },
  ],
  ["Origin null", { origin: "null", "x-tummy-request": "1" }],
  ["no Origin", { "x-tummy-request": "1" }],
  ["no custom header", { origin: TEST_ORIGIN }],
  ["a wrong custom header value", { origin: TEST_ORIGIN, "x-tummy-request": "yes" }],
];

describe("cross-site requests are refused before any work", () => {
  for (const [label, headers] of badHeaders) {
    it(`${label}: every state-changing route answers 403 and nothing changes`, async () => {
      const accountsBefore = await t.raw.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM accounts",
      );
      const auditBefore = await t.raw.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_events",
      );
      const checks = { ...t.hasher.counts };

      for (const route of routes(acct.pin, acct.familyCode)) {
        const res = await t.app.inject({
          method: route.method,
          url: route.url,
          headers: { ...headers, ...cookieHeader(acct.token) },
          ...("payload" in route ? { payload: route.payload } : {}),
        });
        expect(res.statusCode, `${route.method} ${route.url}`).toBe(403);
        expect(apiErrorSchema.parse(res.json()).error.code).toBe("forbidden");
        expect(res.headers["set-cookie"]).toBeUndefined();
      }

      // No account made, no attempt counted, no PIN checked, no event written, still signed in.
      const accountsAfter = await t.raw.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM accounts",
      );
      const auditAfter = await t.raw.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM audit_events",
      );
      expect(accountsAfter.rows[0]).toEqual(accountsBefore.rows[0]);
      expect(auditAfter.rows[0]).toEqual(auditBefore.rows[0]);
      expect(t.hasher.counts).toEqual(checks);
      expect((await accountRow(t.raw, acct.accountId))?.failed_attempts).toBe(0);
      expect((await me(t, acct.token)).statusCode).toBe(200);
    });
  }

  it("reading is not blocked by a foreign Origin (no CORS headers are ever sent, so a foreign page cannot read the answer)", async () => {
    const res = await t.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { origin: "https://evil.example", ...cookieHeader(acct.token) },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("with no origin configured, every state-changing request is refused (fails closed)", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/anything",
      headers: { origin: TEST_ORIGIN, "x-tummy-request": "1" },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
