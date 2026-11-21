import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_FAMILY_CODE, DEMO_PIN, handle, resetDemoServer } from "./demo-server";

const base = "https://demo.invalid";
async function call(method: string, path: string, body?: unknown) {
  const init = body === undefined ? undefined : { body: JSON.stringify(body) };
  const res = handle(method, new URL(path, base), init);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe("demo server", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemoServer();
  });

  it("is signed out at the start, and the sample family can sign in and read its week", async () => {
    expect((await call("GET", "/api/me")).status).toBe(401);
    const signIn = await call("POST", "/api/auth/sign-in/finish", {
      familyCode: "demq 2345 test",
      pin: DEMO_PIN,
    });
    expect(signIn.body).toEqual({ signedIn: true });
    const logs = await call("GET", "/api/logs?since=0");
    expect((logs.body.entries as unknown[]).length).toBeGreaterThan(5);
    expect(DEMO_FAMILY_CODE).toHaveLength(12);
  });

  it("refuses a wrong PIN", async () => {
    const res = await call("POST", "/api/auth/sign-in/finish", {
      familyCode: DEMO_FAMILY_CODE,
      pin: "000000",
    });
    expect(res.status).toBe(401);
  });

  it("creates an account with an empty log, saves and deletes a time with rising revs", async () => {
    const made = await call("POST", "/api/auth/sign-up/finish", { pin: "135792" });
    expect(made.body.familyCode).toMatch(/^[2-9A-HJKMNP-Z]{12}$/);
    const id = "11111111-2222-4333-8444-555555555555";
    const put = await call("PUT", `/api/logs/${id}`, {
      startedAt: new Date().toISOString(),
      durationSeconds: 300,
    });
    expect(put.body.rev).toBe(1);
    const del = await call("DELETE", `/api/logs/${id}`);
    expect(del.body.rev).toBe(2);
    expect(del.body.deletedAt).not.toBeNull();
    const pull = await call("GET", "/api/logs?since=1");
    expect(pull.body).toMatchObject({ latestRev: 2, more: false });
  });

  it("forgets the signed-in family on sign out", async () => {
    await call("POST", "/api/auth/sign-up/finish", { pin: "135792" });
    await call("POST", "/api/auth/sign-out");
    expect((await call("GET", "/api/me")).status).toBe(401);
  });
});
