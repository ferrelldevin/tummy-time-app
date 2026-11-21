import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_FAMILY_CODE,
  DEMO_PIN,
  handle,
  refreshSampleWeek,
  resetDemoServer,
} from "./demo-server";
import type { DemoState } from "./demo-server";
import { sampleWeek } from "./sample-data";

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

  it("answers latestRev the way the real API does: highest rev in the page, or since", async () => {
    await call("POST", "/api/auth/sign-in/finish", { familyCode: DEMO_FAMILY_CODE, pin: DEMO_PIN });
    const all = await call("GET", "/api/logs?since=0");
    const revs = (all.body.entries as { rev: number }[]).map((e) => e.rev);
    expect(all.body.latestRev).toBe(Math.max(...revs));
    const none = await call("GET", `/api/logs?since=${String(Math.max(...revs) + 5)}`);
    expect(none.body).toMatchObject({ entries: [], latestRev: Math.max(...revs) + 5 });
  });

  it("refuses what the real API refuses: a bad since, a bad ID, a start time out of range", async () => {
    await call("POST", "/api/auth/sign-up/finish", { pin: "135792" });
    expect((await call("GET", "/api/logs?since=abc")).status).toBe(400);
    const now = new Date().toISOString();
    const upper = "11111111-2222-4333-8444-55555555555A";
    expect(
      (await call("PUT", `/api/logs/${upper}`, { startedAt: now, durationSeconds: 60 })).status,
    ).toBe(400);
    const id = "11111111-2222-4333-8444-555555555555";
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    expect(
      (await call("PUT", `/api/logs/${id}`, { startedAt: old, durationSeconds: 60 })).status,
    ).toBe(400);
  });

  it("moves the sample week forward on a later day, with new revs, and keeps added entries", () => {
    const day1 = new Date(2026, 0, 10, 12);
    const day4 = new Date(2026, 0, 13, 12);
    const entries = sampleWeek(day1).map((e, i) => ({ ...e, rev: i + 1, deletedAt: null }));
    const added = {
      id: "11111111-2222-4333-8444-555555555555",
      startedAt: day1.toISOString(),
      durationSeconds: 60,
      rev: entries.length + 1,
      deletedAt: null,
    };
    const before: DemoState = {
      accounts: {
        [DEMO_FAMILY_CODE]: { pin: DEMO_PIN, rev: added.rev, entries: [...entries, added] },
      },
      session: null,
      sampleDay: "2026-01-10",
    };
    const after = refreshSampleWeek(before, day4);
    const account = after.accounts[DEMO_FAMILY_CODE];
    expect(after.sampleDay).toBe("2026-01-13");
    expect(account?.entries.find((e) => e.id === added.id)).toEqual(added);
    const first = account?.entries.find((e) => e.id === entries[0]?.id);
    expect(first?.startedAt).toBe(sampleWeek(day4)[0]?.startedAt);
    expect(first?.rev).toBeGreaterThan(added.rev);
    expect(account?.rev).toBe(added.rev + entries.length);
    // Same day again: nothing moves.
    expect(refreshSampleWeek(after, day4)).toBe(after);
  });
});
