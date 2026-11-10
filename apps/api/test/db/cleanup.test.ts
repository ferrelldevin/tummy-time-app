import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ABSOLUTE_LIMIT_MS, IDLE_LIMIT_MS } from "../../src/auth/sessions.js";
import { openDb } from "../../src/db/client.js";
import {
  AUDIT_RETENTION_MS,
  removeEndedSessionsAndOldAuditEvents,
} from "../../src/db/maintenance.js";
import { appSettings, makeAccount, rawPool, removeAccounts } from "./helpers.js";

/**
 * The daily cleanup (pnpm db:cleanup) against the real database, as the app user, with a clock
 * the test sets. Every row is made up. Each limit is tried one second before it, exactly on it
 * and one second after it.
 */
const SECOND = 1000;
// The real "now", so the first run below only removes rows that really are past a limit (the
// same rows the daily cleanup would remove from this database anyway) and never a live session.
// Whole seconds, so a millisecond cannot blur the one-second boundary checks.
const NOW = new Date(Math.floor(Date.now() / 1000) * 1000);
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

describe("db:cleanup", () => {
  const handle = openDb(appSettings());
  const raw = rawPool(appSettings());
  let accountId: string;
  let otherAccountId: string;
  const logIds: string[] = [];

  /** Adds a session row; returns its id_hash. created_at is set early enough for the checks. */
  async function session(lastSeenAt: Date, expiresAt: Date): Promise<string> {
    const idHash = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
    const createdAt = new Date(
      Math.min(lastSeenAt.getTime(), expiresAt.getTime()) - 1000 * 24 * 3600 * 1000,
    );
    await raw.query(
      "INSERT INTO sessions (id_hash, account_id, created_at, last_seen_at, expires_at) VALUES ($1, $2, $3, $4, $5)",
      [idHash, accountId, createdAt, lastSeenAt, expiresAt],
    );
    return idHash;
  }
  async function audit(createdAt: Date, account: string | null = accountId): Promise<string> {
    const id = randomUUID();
    await raw.query(
      "INSERT INTO audit_events (id, type, account_id, created_at) VALUES ($1, 'sign_in', $2, $3)",
      [id, account, createdAt],
    );
    return id;
  }
  async function present(table: "sessions" | "audit_events", column: string, keys: string[]) {
    const { rows } = await raw.query<{ k: string }>(
      `SELECT ${column} AS k FROM ${table} WHERE ${column} = ANY($1::text[])`,
      [keys],
    );
    return new Set(rows.map((r) => r.k));
  }
  const sessionsPresent = (keys: string[]) => present("sessions", "id_hash", keys);
  const auditPresent = (keys: string[]) => present("audit_events", "id::text", keys);

  beforeAll(async () => {
    accountId = await makeAccount(raw);
    otherAccountId = await makeAccount(raw);
    // Clear rows already past a limit (left by earlier runs) so the counts below are exact.
    await removeEndedSessionsAndOldAuditEvents(handle.db, NOW);
  });

  afterAll(async () => {
    await raw.query("DELETE FROM tummy_logs WHERE id = ANY($1::uuid[])", [logIds]);
    await removeAccounts(raw, [accountId, otherAccountId]);
    await Promise.all([handle.close(), raw.end()]);
  });

  it("removes a session at its absolute end, keeps it one second before", async () => {
    const lastSeen = ago(SECOND); // used a second ago, so idle never applies
    const before = await session(lastSeen, ahead(SECOND)); // ends in one second: alive
    const exactly = await session(lastSeen, NOW); // ends right now: over (resolve() uses >=)
    const after = await session(lastSeen, ago(SECOND)); // ended a second ago: over
    const counts = await removeEndedSessionsAndOldAuditEvents(handle.db, NOW);
    expect(counts).toEqual({ sessions: 2, auditEvents: 0 });
    expect(await sessionsPresent([before, exactly, after])).toEqual(new Set([before]));
    await raw.query("DELETE FROM sessions WHERE id_hash = $1", [before]);
  });

  it("removes a session unused for 30 days, keeps it one second before", async () => {
    const farEnd = ahead(ABSOLUTE_LIMIT_MS); // absolute end far away, so only idle applies
    const before = await session(ago(IDLE_LIMIT_MS - SECOND), farEnd);
    const exactly = await session(ago(IDLE_LIMIT_MS), farEnd);
    const after = await session(ago(IDLE_LIMIT_MS + SECOND), farEnd);
    const counts = await removeEndedSessionsAndOldAuditEvents(handle.db, NOW);
    expect(counts).toEqual({ sessions: 2, auditEvents: 0 });
    expect(await sessionsPresent([before, exactly, after])).toEqual(new Set([before]));
    await raw.query("DELETE FROM sessions WHERE id_hash = $1", [before]);
  });

  it("uses the same limits as sign-in: 30 days idle and 90 days absolute", () => {
    expect(IDLE_LIMIT_MS).toBe(30 * 24 * 3600 * 1000);
    expect(ABSOLUTE_LIMIT_MS).toBe(90 * 24 * 3600 * 1000);
  });

  it("removes audit events older than 180 days, keeps them one second before", async () => {
    expect(AUDIT_RETENTION_MS).toBe(180 * 24 * 3600 * 1000);
    const before = await audit(ago(AUDIT_RETENTION_MS - SECOND));
    const exactly = await audit(ago(AUDIT_RETENTION_MS)); // not yet "older than" 180 days
    const after = await audit(ago(AUDIT_RETENTION_MS + SECOND));
    const orphan = await audit(ago(AUDIT_RETENTION_MS + SECOND), null); // no account at all
    const counts = await removeEndedSessionsAndOldAuditEvents(handle.db, NOW);
    expect(counts).toEqual({ sessions: 0, auditEvents: 2 });
    expect(await auditPresent([before, exactly, after, orphan])).toEqual(
      new Set([before, exactly]),
    );
    await raw.query("DELETE FROM audit_events WHERE id = ANY($1::uuid[])", [[before, exactly]]);
  });

  it("keeps live sessions and recent audit events of every account", async () => {
    const live = await session(ago(SECOND), ahead(ABSOLUTE_LIMIT_MS));
    const recent = await audit(ago(DAYS(1)));
    const recentOrphan = await audit(ago(DAYS(179)), null);
    const counts = await removeEndedSessionsAndOldAuditEvents(handle.db, NOW);
    expect(counts).toEqual({ sessions: 0, auditEvents: 0 });
    expect(await sessionsPresent([live])).toEqual(new Set([live]));
    expect(await auditPresent([recent, recentOrphan])).toEqual(new Set([recent, recentOrphan]));
    await raw.query("DELETE FROM sessions WHERE id_hash = $1", [live]);
    await raw.query("DELETE FROM audit_events WHERE id = ANY($1::uuid[])", [
      [recent, recentOrphan],
    ]);
  });

  it("never touches tummy logs (marked deleted or not) or accounts", async () => {
    const old = ago(DAYS(400));
    const plain = randomUUID();
    const markedDeleted = randomUUID();
    const markedLongAgo = randomUUID();
    logIds.push(plain, markedDeleted, markedLongAgo);
    for (const [id, deletedAt] of [
      [plain, null],
      [markedDeleted, ago(DAYS(91))],
      [markedLongAgo, old],
    ] as const) {
      await raw.query(
        "INSERT INTO tummy_logs (id, account_id, started_at, duration_seconds, updated_at, deleted_at) VALUES ($1, $2, $3, 60, $3, $4)",
        [id, accountId, old, deletedAt],
      );
    }
    // Everything else about the account is as old as can be.
    await session(old, ago(DAYS(300)));
    await audit(old);
    const counts = await removeEndedSessionsAndOldAuditEvents(handle.db, NOW);
    expect(counts).toEqual({ sessions: 1, auditEvents: 1 });
    const logs = await raw.query<{ id: string }>(
      "SELECT id FROM tummy_logs WHERE id = ANY($1::uuid[])",
      [logIds],
    );
    expect(logs.rows.map((r) => r.id).sort()).toEqual([...logIds].sort());
    const accounts = await raw.query<{ id: string }>(
      "SELECT id FROM accounts WHERE id = ANY($1::uuid[])",
      [[accountId, otherAccountId]],
    );
    expect(accounts.rows).toHaveLength(2);
  });

  it("runs twice without error, and the second run removes nothing", async () => {
    await session(ago(DAYS(40)), ahead(DAYS(10)));
    await audit(ago(DAYS(200)));
    expect(await removeEndedSessionsAndOldAuditEvents(handle.db, NOW)).toEqual({
      sessions: 1,
      auditEvents: 1,
    });
    expect(await removeEndedSessionsAndOldAuditEvents(handle.db, NOW)).toEqual({
      sessions: 0,
      auditEvents: 0,
    });
  });

  it("can run at the same moment as itself without error (two runs at once)", async () => {
    for (let i = 0; i < 20; i++) {
      await session(ago(DAYS(40)), ahead(DAYS(10)));
      await audit(ago(DAYS(200)));
    }
    const [one, two] = await Promise.all([
      removeEndedSessionsAndOldAuditEvents(handle.db, NOW),
      removeEndedSessionsAndOldAuditEvents(handle.db, NOW),
    ]);
    // Each row is removed by exactly one of the two runs.
    expect(one.sessions + two.sessions).toBe(20);
    expect(one.auditEvents + two.auditEvents).toBe(20);
  });
});

function DAYS(n: number): number {
  return n * 24 * 3600 * 1000;
}
