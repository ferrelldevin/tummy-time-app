import { lt, lte, or } from "drizzle-orm";
import { IDLE_LIMIT_MS } from "../auth/sessions.js";
import type { Db } from "./client.js";
import { auditEvents, sessions } from "./schema.js";

/**
 * THE DAILY CLEANUP (docs/data-map.md, "How long we keep it"; `pnpm db:cleanup`).
 *
 * WHY THIS FILE IS OUTSIDE account-scope.ts. Every other query on these tables adds "this
 * account's ID". Cleanup has to reach rows of every account at once, because the point is to
 * clear out rows that nobody will ever present again. The account-scope guard test
 * (test/account-scope-guard.test.ts) therefore lists THIS file, and only this file, for exactly
 * the two tables below. To keep that door small on purpose:
 * - the one function takes no ID and no filter from a caller, only the clock's "now";
 * - it returns two numbers (how many rows went), never a row or a column of one;
 * - it can only delete. No read, no update, no other table.
 * Anything more belongs in account-scope.ts, not here.
 *
 * It must NOT touch tummy_logs or accounts. In particular it does NOT erase "deleted" tummy log
 * entries yet, although the data map says they go after 90 days. docs/adr/0005-sync.md ("Known
 * gap") explains why: a phone that has not synced for longer than that window would never hear
 * about the delete and would keep showing the entry. The rule for such a phone (for example,
 * "start again from zero") has to be decided first. Until then those rows stay.
 *
 * Safe to run twice, and while the API is running: each delete is one statement, and a row it
 * removes is a row the API would already refuse. A session the API is refreshing in the same
 * instant is either removed (the phone signs in again) or kept; neither breaks anything.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** docs/data-map.md: audit events are kept 180 days. */
export const AUDIT_RETENTION_MS = 180 * DAY_MS;

export interface CleanupCounts {
  sessions: number;
  auditEvents: number;
}

/**
 * Deletes sessions that the API would refuse anyway, and audit events older than 180 days.
 * A session is over when `now` has reached its absolute end (expires_at) or the time it was
 * last used plus the idle limit: the same two tests as sessionService.resolve() in
 * src/auth/sessions.ts, which uses the same constant. An audit event is deleted only when it is
 * strictly older than 180 days.
 */
export async function removeEndedSessionsAndOldAuditEvents(
  db: Db,
  now: Date,
): Promise<CleanupCounts> {
  const idleCutoff = new Date(now.getTime() - IDLE_LIMIT_MS);
  const auditCutoff = new Date(now.getTime() - AUDIT_RETENTION_MS);
  const endedSessions = await db
    .delete(sessions)
    .where(or(lte(sessions.expiresAt, now), lte(sessions.lastSeenAt, idleCutoff)));
  const oldAudit = await db.delete(auditEvents).where(lt(auditEvents.createdAt, auditCutoff));
  return { sessions: endedSessions.rowCount ?? 0, auditEvents: oldAudit.rowCount ?? 0 };
}
