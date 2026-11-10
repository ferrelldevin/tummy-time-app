import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LOG_MAX_AGE_MS,
  LOG_MAX_FUTURE_MS,
  LOG_PAGE_SIZE,
  apiErrorSchema,
  logEntrySchema,
  logsPageSchema,
} from "@tummy/shared";
import { SAME_SITE } from "../same-site.js";
import {
  authTestApp,
  cookieHeader,
  sessionToken,
  signIn,
  signUp,
  type AuthTestApp,
  type SignedUp,
} from "../auth/helpers.js";
import { deleteLog, getLogs, newId, pull, pullAll, put, putLog, sampleEntry } from "./helpers.js";

/**
 * The tummy time log routes, through the real app, the real sign-in guard and the real database
 * (Block 6, ADR 0005). Every account and entry here is made up and removed afterwards.
 */

let t: AuthTestApp;
let a: SignedUp;
let b: SignedUp;

beforeAll(async () => {
  t = await authTestApp();
  a = await signUp(t);
  b = await signUp(t);
});
afterAll(async () => {
  await t.close();
});

function errorCode(body: string): string {
  return apiErrorSchema.parse(JSON.parse(body)).error.code;
}

describe("create, edit, delete, undo", () => {
  it("PUT creates an entry and answers it, stamped with a rev", async () => {
    const id = newId();
    const body = sampleEntry(t);
    const res = await putLog(t, a.token, id, body);
    expect(res.statusCode).toBe(200);
    const entry = logEntrySchema.parse(res.json());
    expect(entry).toMatchObject({ id, durationSeconds: 300, deletedAt: null });
    expect(new Date(entry.startedAt).getTime()).toBe(new Date(body.startedAt).getTime());
    expect(entry.rev).toBeGreaterThan(0);
    // Only the five sync fields leave the server: no account ID, no updated_at.
    expect(Object.keys(res.json<object>()).sort()).toEqual(
      ["deletedAt", "durationSeconds", "id", "rev", "startedAt"].sort(),
    );
  });

  it("PUT on an existing entry replaces it with a new rev", async () => {
    const id = newId();
    const first = await put(t, a.token, id, sampleEntry(t, 40, 120));
    const edited = await put(t, a.token, id, sampleEntry(t, 35, 600));
    expect(edited.durationSeconds).toBe(600);
    expect(edited.rev).toBeGreaterThan(first.rev);
    const changes = await pull(t, a.token, first.rev);
    expect(changes.entries.filter((e) => e.id === id)).toEqual([edited]);
  });

  it("DELETE marks the entry deleted with a new rev, and the delete is pulled like any change", async () => {
    const id = newId();
    const created = await put(t, a.token, id, sampleEntry(t));
    const res = await deleteLog(t, a.token, id);
    expect(res.statusCode).toBe(200);
    const deleted = logEntrySchema.parse(res.json());
    expect(deleted.deletedAt).toBe(t.clock.now().toISOString());
    expect(deleted.rev).toBeGreaterThan(created.rev);
    const changes = await pull(t, a.token, created.rev);
    expect(changes.entries.find((e) => e.id === id)).toEqual(deleted);
    // Marked, not erased: the row is still in the database.
    const { rows } = await t.raw.query<{ n: string }>(
      "SELECT count(*) AS n FROM tummy_logs WHERE id = $1",
      [id],
    );
    expect(rows[0]?.n).toBe("1");
  });

  it("DELETE on an entry that is already deleted answers the same entry and changes nothing", async () => {
    const id = newId();
    await put(t, a.token, id, sampleEntry(t));
    const first = (await deleteLog(t, a.token, id)).json<{ rev: number }>();
    t.clock.advance(1000);
    const again = await deleteLog(t, a.token, id);
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first);
  });

  it("PUT on a deleted entry brings it back (this is how undo works)", async () => {
    const id = newId();
    const body = sampleEntry(t);
    await put(t, a.token, id, body);
    const deleted = (await deleteLog(t, a.token, id)).json<{ rev: number }>();
    const back = await put(t, a.token, id, body);
    expect(back.deletedAt).toBeNull();
    expect(back.rev).toBeGreaterThan(deleted.rev);
    expect((await pull(t, a.token, deleted.rev)).entries).toContainEqual(back);
  });

  it("the same write sent twice is harmless: one entry, the same contents", async () => {
    const id = newId();
    const body = sampleEntry(t, 20, 240);
    const one = await put(t, a.token, id, body);
    const two = await put(t, a.token, id, body);
    expect({ ...two, rev: one.rev }).toEqual(one);
    const all = (await pullAll(t, a.token)).flatMap((p) => p.entries);
    expect(all.filter((e) => e.id === id)).toHaveLength(1);
  });

  it("DELETE on an ID that this account never had answers 404", async () => {
    const res = await deleteLog(t, a.token, newId());
    expect(res.statusCode).toBe(404);
    expect(errorCode(res.body)).toBe("not_found");
  });
});

describe("two phones on one account: the last write to reach the server wins", () => {
  it("phone 2's later edit wins over phone 1's, and both phones pull the same result", async () => {
    const phone2 = sessionToken(await signIn(t, a.familyCode, a.pin));
    expect(phone2).toBeDefined();
    const token2 = phone2 ?? "";
    const id = newId();
    const created = await put(t, a.token, id, sampleEntry(t, 50, 300));
    // Both phones edit the same entry; phone 1's edit reaches the server first.
    await put(t, a.token, id, sampleEntry(t, 50, 420));
    const last = await put(t, token2, id, sampleEntry(t, 50, 480));
    for (const token of [a.token, token2]) {
      const seen = (await pullAll(t, token, created.rev - 1)).flatMap((p) => p.entries);
      expect(seen.filter((e) => e.id === id)).toEqual([last]);
    }
  });

  it("a delete on one phone and an edit that arrives later on the other: the edit wins", async () => {
    const token2 = sessionToken(await signIn(t, a.familyCode, a.pin)) ?? "";
    const id = newId();
    await put(t, a.token, id, sampleEntry(t));
    await deleteLog(t, token2, id);
    const later = await put(t, a.token, id, sampleEntry(t, 30, 360));
    expect(later.deletedAt).toBeNull();
    const seen = (await pullAll(t, token2)).flatMap((p) => p.entries);
    expect(seen.filter((e) => e.id === id)).toEqual([later]);
  });
});

describe("pull", () => {
  it("answers entries in rev order, with latestRev the highest rev in the answer", async () => {
    const fresh = await signUp(t);
    const ids = [newId(), newId(), newId()];
    for (const id of ids) await put(t, fresh.token, id, sampleEntry(t));
    const page = logsPageSchema.parse((await getLogs(t, fresh.token)).json());
    expect(page.entries.map((e) => e.id)).toEqual(ids);
    const revs = page.entries.map((e) => e.rev);
    expect(revs).toEqual([...revs].sort((x, y) => x - y));
    expect(page.latestRev).toBe(revs.at(-1));
    expect(page.more).toBe(false);
  });

  it("with nothing new, answers no entries and latestRev equal to since", async () => {
    const fresh = await signUp(t);
    expect(await pull(t, fresh.token, 0)).toEqual({ entries: [], latestRev: 0, more: false });
    expect(await pull(t, fresh.token, 123_456)).toEqual({
      entries: [],
      latestRev: 123_456,
      more: false,
    });
    // since left out means 0.
    expect(await pull(t, fresh.token)).toEqual({ entries: [], latestRev: 0, more: false });
  });

  it("after a long gap, pages through every change, at most 500 at a time", async () => {
    const fresh = await signUp(t);
    const total = 2 * LOG_PAGE_SIZE + 3;
    // Made directly in the database to keep the test quick. Same columns the API writes.
    const start = new Date(t.clock.now().getTime() - 60 * 60_000);
    const { rows } = await t.raw.query<{ id: string }>(
      `INSERT INTO tummy_logs (id, account_id, started_at, duration_seconds)
       SELECT gen_random_uuid(), $1, $2, 60 FROM generate_series(1, $3) RETURNING id`,
      [fresh.accountId, start, total],
    );
    const pages = await pullAll(t, fresh.token, 0);
    expect(pages.map((p) => p.entries.length)).toEqual([LOG_PAGE_SIZE, LOG_PAGE_SIZE, 3]);
    expect(pages.map((p) => p.more)).toEqual([true, true, false]);
    for (const page of pages) {
      expect(page.latestRev).toBe(page.entries.at(-1)?.rev);
    }
    const seen = pages.flatMap((p) => p.entries.map((e) => e.id));
    expect(new Set(seen).size).toBe(total);
    expect(new Set(seen)).toEqual(new Set(rows.map((r) => r.id)));
  });

  it("asking with since equal to the very last rev answers nothing more", async () => {
    const fresh = await signUp(t);
    const entry = await put(t, fresh.token, newId(), sampleEntry(t));
    expect(await pull(t, fresh.token, entry.rev)).toEqual({
      entries: [],
      latestRev: entry.rev,
      more: false,
    });
  });
});

describe("another account's entries (threat model #8)", () => {
  it("PUT on an ID that belongs to another account answers 404 and leaves it untouched", async () => {
    const id = newId();
    const theirs = await put(t, b.token, id, sampleEntry(t, 10, 100));
    const res = await putLog(t, a.token, id, sampleEntry(t, 15, 999));
    expect(res.statusCode).toBe(404);
    expect(errorCode(res.body)).toBe("not_found");
    const { rows } = await t.raw.query<{
      account_id: string;
      duration_seconds: number;
      rev: string;
    }>("SELECT account_id, duration_seconds, rev FROM tummy_logs WHERE id = $1", [id]);
    expect(rows).toEqual([
      { account_id: b.accountId, duration_seconds: 100, rev: String(theirs.rev) },
    ]);
  });

  it("PUT on another account's DELETED entry does not bring it back", async () => {
    const id = newId();
    await put(t, b.token, id, sampleEntry(t));
    await deleteLog(t, b.token, id);
    expect((await putLog(t, a.token, id, sampleEntry(t))).statusCode).toBe(404);
    const { rows } = await t.raw.query<{ deleted_at: Date | null }>(
      "SELECT deleted_at FROM tummy_logs WHERE id = $1",
      [id],
    );
    expect(rows[0]?.deleted_at).not.toBeNull();
  });

  it("DELETE on another account's entry answers exactly like an ID that does not exist", async () => {
    const id = newId();
    await put(t, b.token, id, sampleEntry(t));
    const theirs = await deleteLog(t, a.token, id);
    const nobodys = await deleteLog(t, a.token, newId());
    expect(theirs.statusCode).toBe(404);
    expect(theirs.statusCode).toBe(nobodys.statusCode);
    expect(theirs.body).toBe(nobodys.body);
    const { rows } = await t.raw.query<{ deleted_at: Date | null }>(
      "SELECT deleted_at FROM tummy_logs WHERE id = $1",
      [id],
    );
    expect(rows[0]?.deleted_at).toBeNull();
  });

  it("GET never answers another account's entries, at any since", async () => {
    const mine = await put(t, a.token, newId(), sampleEntry(t));
    const theirs = await put(t, b.token, newId(), sampleEntry(t));
    for (const since of [0, mine.rev - 1, theirs.rev - 1]) {
      const seen = (await pullAll(t, a.token, since)).flatMap((p) => p.entries.map((e) => e.id));
      expect(seen).not.toContain(theirs.id);
    }
    const bSees = (await pullAll(t, b.token)).flatMap((p) => p.entries.map((e) => e.id));
    expect(bSees).toContain(theirs.id);
    expect(bSees).not.toContain(mine.id);
  });
});

describe("validation: each limit at its edge and one past it", () => {
  const now = () => t.clock.now().getTime();

  it.each([
    [1, 200],
    [0, 400],
    [7200, 200],
    [7201, 400],
    [-1, 400],
    [60.5, 400],
  ])("durationSeconds %d answers %d", async (durationSeconds, status) => {
    const res = await putLog(t, a.token, newId(), { ...sampleEntry(t), durationSeconds });
    expect(res.statusCode).toBe(status);
  });

  it("startedAt may be up to 5 minutes ahead (phone clocks drift), and not 1 ms more", async () => {
    const edge = new Date(now() + LOG_MAX_FUTURE_MS).toISOString();
    const past = new Date(now() + LOG_MAX_FUTURE_MS + 1).toISOString();
    expect(
      (await putLog(t, a.token, newId(), { ...sampleEntry(t), startedAt: edge })).statusCode,
    ).toBe(200);
    const res = await putLog(t, a.token, newId(), { ...sampleEntry(t), startedAt: past });
    expect(res.statusCode).toBe(400);
    expect(errorCode(res.body)).toBe("bad_request");
  });

  it("startedAt may be as old as 365 days, and not 1 ms older", async () => {
    const edge = new Date(now() - LOG_MAX_AGE_MS).toISOString();
    const past = new Date(now() - LOG_MAX_AGE_MS - 1).toISOString();
    expect(
      (await putLog(t, a.token, newId(), { ...sampleEntry(t), startedAt: edge })).statusCode,
    ).toBe(200);
    expect(
      (await putLog(t, a.token, newId(), { ...sampleEntry(t), startedAt: past })).statusCode,
    ).toBe(400);
  });

  it("the time limits follow the server's clock, not the request", async () => {
    const id = newId();
    const soon = new Date(now() + LOG_MAX_FUTURE_MS + 60_000).toISOString();
    expect((await putLog(t, a.token, id, { ...sampleEntry(t), startedAt: soon })).statusCode).toBe(
      400,
    );
    t.clock.advance(2 * 60_000);
    expect((await putLog(t, a.token, id, { ...sampleEntry(t), startedAt: soon })).statusCode).toBe(
      200,
    );
  });

  it.each([
    ["a time with no offset", { startedAt: "2026-11-10T09:00:00", durationSeconds: 60 }],
    ["a date that does not exist", { startedAt: "2026-02-30T09:00:00Z", durationSeconds: 60 }],
    ["a number for startedAt", { startedAt: 1_700_000_000_000, durationSeconds: 60 }],
    ["a string duration", { startedAt: "2026-11-10T09:00:00Z", durationSeconds: "60" }],
    ["an unknown field", { startedAt: "2026-11-10T09:00:00Z", durationSeconds: 60, note: "x" }],
    [
      "an account ID in the body",
      { startedAt: "2026-11-10T09:00:00Z", durationSeconds: 60, accountId: "x" },
    ],
    ["a missing field", { durationSeconds: 60 }],
  ])("PUT refuses %s", async (_name, payload) => {
    const res = await putLog(t, a.token, newId(), payload);
    expect(res.statusCode).toBe(400);
    expect(errorCode(res.body)).toBe("bad_request");
  });

  it.each([
    ["upper case", "3F2B8C1E-7A4D-4E5F-9B6A-0C1D2E3F4A5B"],
    ["no dashes", "3f2b8c1e7a4d4e5f9b6a0c1d2e3f4a5b"],
    ["too short", "3f2b8c1e-7a4d-4e5f-9b6a-0c1d2e3f4a5"],
    ["not a UUID", "1%20OR%201%3D1"],
    ["braces", "%7B3f2b8c1e-7a4d-4e5f-9b6a-0c1d2e3f4a5b%7D"],
  ])("PUT and DELETE refuse an ID that is %s", async (_name, id) => {
    expect((await putLog(t, a.token, id, sampleEntry(t))).statusCode).toBe(400);
    expect((await deleteLog(t, a.token, id)).statusCode).toBe(400);
  });

  it.each([
    ["0", 200],
    [String(Number.MAX_SAFE_INTEGER), 200],
    [String(Number.MAX_SAFE_INTEGER + 1), 400],
    ["-1", 400],
    ["1.5", 400],
    ["01", 400],
    ["1e3", 400],
    ["abc", 400],
    ["", 400],
  ])("GET since=%s answers %d", async (since, status) => {
    expect((await getLogs(t, a.token, since)).statusCode).toBe(status);
  });

  it("GET refuses since given twice, and an unknown query field", async () => {
    const twice = await t.app.inject({
      method: "GET",
      url: "/api/logs?since=1&since=2",
      headers: cookieHeader(a.token),
    });
    expect(twice.statusCode).toBe(400);
    const unknown = await t.app.inject({
      method: "GET",
      url: "/api/logs?since=1&account=x",
      headers: cookieHeader(a.token),
    });
    expect(unknown.statusCode).toBe(400);
  });

  it("DELETE refuses a body", async () => {
    const id = (await put(t, a.token, newId(), sampleEntry(t))).id;
    const res = await t.app.inject({
      method: "DELETE",
      url: `/api/logs/${id}`,
      headers: { ...SAME_SITE, ...cookieHeader(a.token) },
      payload: { durationSeconds: 1 },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("sign-in and cross-site checks on every log route", () => {
  const id = "3f2b8c1e-7a4d-4e5f-9b6a-0c1d2e3f4a5b";

  it.each([
    ["PUT", `/api/logs/${id}`, true],
    ["DELETE", `/api/logs/${id}`, false],
    ["GET", "/api/logs?since=0", false],
  ] as const)("%s %s without a session answers 401", async (method, url, withBody) => {
    const res = await t.app.inject({
      method,
      url,
      headers: SAME_SITE,
      ...(withBody ? { payload: sampleEntry(t) } : {}),
    });
    expect(res.statusCode).toBe(401);
    expect(errorCode(res.body)).toBe("unauthorized");
  });

  it.each([
    ["PUT", `/api/logs/${id}`, true],
    ["DELETE", `/api/logs/${id}`, false],
  ] as const)(
    "%s %s from another site answers 403, before any work",
    async (method, url, withBody) => {
      for (const headers of [
        { origin: "https://evil.example", "x-tummy-request": "1" },
        { origin: SAME_SITE.origin },
        {},
      ]) {
        const res = await t.app.inject({
          method,
          url,
          headers: { ...headers, ...cookieHeader(a.token) },
          ...(withBody ? { payload: sampleEntry(t) } : {}),
        });
        expect(res.statusCode).toBe(403);
        expect(errorCode(res.body)).toBe("forbidden");
      }
      const { rows } = await t.raw.query("SELECT 1 FROM tummy_logs WHERE id = $1", [id]);
      expect(rows).toHaveLength(0);
    },
  );

  it("an ended session answers 401", async () => {
    const res = await t.app.inject({
      method: "GET",
      url: "/api/logs",
      headers: cookieHeader("a".repeat(43)),
    });
    expect(res.statusCode).toBe(401);
  });
});
