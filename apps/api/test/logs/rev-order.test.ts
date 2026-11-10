import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { LogEntry } from "@tummy/shared";
import { forAccount, toAccountId } from "../../src/db/account-scope.js";
import { openDb } from "../../src/db/client.js";
import { authTestApp, signUp, type AuthTestApp, type SignedUp } from "../auth/helpers.js";
import { appSettings } from "../db/helpers.js";
import { newId, pull, put, putLog, sampleEntry } from "./helpers.js";

/**
 * THE REV ORDER RULE (ADR 0009). Revs come from one counter, but two writes that overlap could
 * commit in the opposite order to their revs, and a phone asking "after rev N" at the wrong
 * moment would miss a row for ever. Every write for one account takes a lock on the account's
 * row first, so one account's writes commit in rev order. These tests prove it.
 */

let t: AuthTestApp;
let acct: SignedUp;
const handle = openDb(appSettings());

beforeAll(async () => {
  t = await authTestApp();
  acct = await signUp(t);
});
afterAll(async () => {
  await t.close();
  await handle.close();
});

/** Is the promise still waiting after `ms`? */
async function stillWaiting(promise: Promise<unknown>, ms: number): Promise<boolean> {
  const pending = Symbol("pending");
  const winner = await Promise.race([
    promise.then(() => "done"),
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(pending);
      }, ms);
    }),
  ]);
  return winner === pending;
}

/** Waits until some database session is waiting on a row lock held by another. */
async function untilSomeoneWaitsOnALock(): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const { rows } = await t.raw.query<{ n: string }>(
      `SELECT count(*) AS n FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (Number(rows[0]?.n) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("No write ever waited on the account lock.");
}

describe("one account's writes commit in rev order", () => {
  it("while write A is open, write B for the same account waits, then gets a higher rev, committed after A", async () => {
    let releaseA: () => void = () => undefined;
    const aMayCommit = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    let aRev = 0;
    let aCommitted = false;
    const idA = newId();
    const idB = newId();
    const before = (await pull(t, acct.token, 0)).latestRev;

    // Write A: the real write path, inside a transaction this test holds open.
    const writeA = handle.db
      .transaction(async (tx) => {
        const result = await forAccount(tx, toAccountId(acct.accountId)).logs.put(
          { id: idA, startedAt: new Date(sampleEntry(t).startedAt), durationSeconds: 60 },
          t.clock.now(),
        );
        if (result.outcome !== "written") throw new Error("A was not written");
        aRev = result.entry.rev;
        await aMayCommit;
      })
      .then(() => {
        aCommitted = true;
      });
    // Let A take the lock and its rev before B starts.
    for (let i = 0; i < 100 && aRev === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(aRev).toBeGreaterThan(0);

    // Write B: a real PUT through the API, for the same account.
    const writeB = put(t, acct.token, idB, sampleEntry(t, 10, 120));
    await untilSomeoneWaitsOnALock();
    expect(await stillWaiting(writeB, 300)).toBe(true);

    // A phone pulling now sees neither: A is not committed, and B has not even started writing.
    const during = await pull(t, acct.token, before);
    expect(during.entries.map((e) => e.id)).toEqual([]);
    expect(during.latestRev).toBe(before);

    releaseA();
    const b: LogEntry = await writeB;
    await writeA;
    expect(aCommitted).toBe(true);
    expect(b.rev).toBeGreaterThan(aRev);

    // The phone that pulled during the wait, asking again from the latestRev it was told,
    // gets both rows, A first.
    const after = await pull(t, acct.token, during.latestRev);
    expect(after.entries.map((e) => e.id)).toEqual([idA, idB]);
  });

  it("writes for another account do not wait for this account's lock", async () => {
    const other = await signUp(t);
    let releaseA: () => void = () => undefined;
    const aMayCommit = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    // An object, so the loop below reads the value the transaction sets.
    const a = { locked: false };
    const writeA = handle.db.transaction(async (tx) => {
      await forAccount(tx, toAccountId(acct.accountId)).logs.put(
        { id: newId(), startedAt: new Date(sampleEntry(t).startedAt), durationSeconds: 60 },
        t.clock.now(),
      );
      a.locked = true;
      await aMayCommit;
    });
    for (let i = 0; i < 100 && !a.locked; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const res = await putLog(t, other.token, newId(), sampleEntry(t));
    expect(res.statusCode).toBe(200);
    releaseA();
    await writeA;
  });

  it("many writes at once, with pulls in between that only ever ask from the last latestRev, leave the phone with every row", async () => {
    const fresh = await signUp(t);
    const writes = 120;
    const ids = Array.from({ length: writes }, () => newId());
    const phone = new Map<string, LogEntry>();
    let since = 0;
    // An object, so the puller reads the value set after the writes finish.
    const state = { writing: true };

    const puller = (async () => {
      while (state.writing) {
        const page = await pull(t, fresh.token, since);
        for (const e of page.entries) phone.set(e.id, e);
        since = page.latestRev;
      }
    })();
    // Each entry is written twice (create, then edit), all at once, in no particular order.
    await Promise.all(
      ids.flatMap((id, i) => [
        put(t, fresh.token, id, sampleEntry(t, 60, 60 + i)),
        put(t, fresh.token, id, sampleEntry(t, 60, 600 + i)),
      ]),
    );
    state.writing = false;
    await puller;
    // One last pull, as the phone does when it next opens.
    for (;;) {
      const page = await pull(t, fresh.token, since);
      for (const e of page.entries) phone.set(e.id, e);
      since = page.latestRev;
      if (!page.more) break;
    }

    expect(phone.size).toBe(writes);
    // The phone holds exactly what the server holds, row for row.
    const { rows } = await t.raw.query<{ id: string; rev: string; duration_seconds: number }>(
      "SELECT id, rev, duration_seconds FROM tummy_logs WHERE account_id = $1",
      [fresh.accountId],
    );
    expect(rows).toHaveLength(writes);
    for (const row of rows) {
      expect(phone.get(row.id)?.rev).toBe(Number(row.rev));
      expect(phone.get(row.id)?.durationSeconds).toBe(row.duration_seconds);
    }
  });
});
