import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { forAccount, toAccountId, type AccountScope } from "../../src/db/account-scope.js";
import { openDb } from "../../src/db/client.js";
import { appSettings, makeAccount, rawPool, removeAccounts } from "./helpers.js";

/**
 * Threat model #8: one account must never read or change another account's rows.
 * Two made-up accounts, A and B, each with their own rows. Everything here runs as the app user.
 */
describe("forAccount(): always filters by the signed-in account", () => {
  const handle = openDb(appSettings());
  const raw = rawPool(appSettings());
  let a: AccountScope;
  let b: AccountScope;
  let aLog: string;
  let bLog: string;

  beforeAll(async () => {
    const [idA, idB] = [await makeAccount(raw), await makeAccount(raw)];
    a = forAccount(handle.db, toAccountId(idA));
    b = forAccount(handle.db, toAccountId(idB));
    aLog = randomUUID();
    bLog = randomUUID();
    await a.logs.insert({ id: aLog, startedAt: new Date(), durationSeconds: 120 });
    await b.logs.insert({ id: bLog, startedAt: new Date(), durationSeconds: 300 });
    await a.audit.record("sign_in");
    await b.audit.record("sign_in_failed");
    const later = new Date(Date.now() + 60_000);
    await raw.query(
      "INSERT INTO sessions (id_hash, account_id, expires_at) VALUES ($1, $2, $3), ($4, $5, $3)",
      ["a".repeat(64), idA, later, "b".repeat(64), idB],
    );
  });

  afterAll(async () => {
    await removeAccounts(raw, [a.accountId, b.accountId]);
    await Promise.all([handle.close(), raw.end()]);
  });

  it("lists only this account's logs", async () => {
    expect((await a.logs.list()).map((l) => l.id)).toEqual([aLog]);
    expect((await b.logs.list()).map((l) => l.id)).toEqual([bLog]);
  });

  it("cannot get another account's log by its ID", async () => {
    expect(await a.logs.get(bLog)).toBeUndefined();
    expect((await a.logs.get(aLog))?.durationSeconds).toBe(120);
  });

  it("cannot change another account's log", async () => {
    expect(
      await a.logs.update(bLog, { durationSeconds: 1, deletedAt: new Date() }),
    ).toBeUndefined();
    const untouched = await b.logs.get(bLog);
    expect(untouched?.durationSeconds).toBe(300);
    expect(untouched?.deletedAt).toBeNull();
  });

  it("insert always sets this account, even if the caller passes another", async () => {
    const id = randomUUID();
    const sneaky = { id, startedAt: new Date(), durationSeconds: 60, accountId: b.accountId };
    const row = await a.logs.insert(sneaky);
    expect(row.accountId).toBe(a.accountId);
    expect(await b.logs.get(id)).toBeUndefined();
  });

  it("every write takes the next number from the one counter", async () => {
    const before = await a.logs.get(aLog);
    const after = await a.logs.update(aLog, { durationSeconds: 150 });
    expect(after?.rev).toBeGreaterThan(before?.rev ?? Number.MAX_SAFE_INTEGER);
    expect((await a.logs.list(before?.rev ?? 0)).map((l) => l.id)).toContain(aLog);
  });

  it("sessions and audit events are scoped the same way", async () => {
    expect((await a.sessions.list()).map((s) => s.idHash)).toEqual(["a".repeat(64)]);
    expect((await a.audit.list()).map((e) => e.type)).toEqual(["sign_in"]);
    expect(await a.sessions.deleteAll()).toBe(1);
    expect((await b.sessions.list()).length).toBe(1);
  });

  it("refuses an account ID that is not a UUID", () => {
    expect(() => toAccountId("1 OR 1=1")).toThrow();
  });
});
