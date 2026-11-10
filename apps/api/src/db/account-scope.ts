import { and, asc, count, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Queryable } from "./client.js";
import { accounts, auditEvents, sessions, tummyLogs, type AuditEventType } from "./schema.js";

/**
 * THE ONE DOOR to rows that belong to an account (threat model #8).
 *
 * Every query on tummy_logs, sessions and audit_events goes through forAccount(). Each method
 * adds "account_id = <the signed-in account>" to its WHERE clause, and every insert sets
 * account_id itself, so a caller cannot forget the filter or point a row at another account.
 *
 * test/account-scope-guard.test.ts fails the build if any other file under src/ imports these
 * tables or names them in SQL text. test/db/account-scope.test.ts proves the filter holds with
 * two accounts.
 *
 * Lookups that happen before anyone is signed in (find a session by its hash, find an account
 * by its code) live in src/auth/credential-store.ts, the one other file the guard allows.
 *
 * The accounts table is used here for two things only, both by this account's own ID: locking
 * the account's row before a write to its tummy logs (see lockedLogWrite below), and deleting
 * the account for good.
 */

declare const accountIdBrand: unique symbol;
/** An account ID that has been checked. Block 4 makes these from the signed-in session. */
export type AccountId = string & { readonly [accountIdBrand]: true };

const uuidSchema = z.uuid();

/** Checks that a value is a UUID and marks it as an account ID. */
export function toAccountId(value: string): AccountId {
  return uuidSchema.parse(value) as AccountId;
}

export type TummyLog = typeof tummyLogs.$inferSelect;
export interface NewTummyLog {
  id: string;
  startedAt: Date;
  durationSeconds: number;
}
export interface TummyLogChanges {
  startedAt?: Date;
  durationSeconds?: number;
  deletedAt?: Date | null;
}
export type Session = typeof sessions.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;

/** The next number from the one rev counter (ADR 0005). Only ever taken under the account lock. */
const nextRev = sql<number>`nextval('tummy_logs_rev_seq')`;

/**
 * What a sync write did.
 * - written: the entry was stored with a new rev.
 * - unchanged: nothing needed to change (deleting an entry that is already deleted).
 * - not_found: no entry with this ID belongs to this account. An entry with this ID that belongs
 *   to another account gives this same answer, and is left exactly as it was.
 * - no_account: the account itself is gone (deleted while the request was on its way).
 */
export type LogWriteResult =
  | { outcome: "written" | "unchanged"; entry: TummyLog }
  | { outcome: "not_found" }
  | { outcome: "no_account" };

export interface LogChanges {
  /** At most `limit` entries changed after the asked-for rev, oldest change first. */
  entries: TummyLog[];
  /** The highest rev among `entries`, or the asked-for rev when there are none. */
  latestRev: number;
  /** True when more changed entries are waiting after these. */
  more: boolean;
}

const NO_ACCOUNT = Symbol("no account");

export interface NewSession {
  idHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export function forAccount(db: Queryable, accountId: AccountId) {
  const ownLog = (extra?: SQL) => and(eq(tummyLogs.accountId, accountId), extra);
  const ownSession = (extra?: SQL) => and(eq(sessions.accountId, accountId), extra);

  /**
   * THE REV ORDER RULE (ADR 0009). Every write to this account's tummy logs runs here: in one
   * transaction that first locks this account's row, and only then takes the next rev and writes.
   * Two writes for one account therefore never overlap: the second waits for the first to commit.
   * So this account's writes commit in the same order as their rev numbers, and a phone that has
   * seen rev N can never later find a row with a smaller rev it has not seen. Without the lock,
   * write A could take rev 41, write B rev 42, B commit first, a phone pull and record 42, and
   * A's row 41 would never be sent to that phone.
   * Writes for different accounts do not wait for each other.
   */
  async function lockedLogWrite<T>(
    work: (tx: Queryable) => Promise<T>,
  ): Promise<T | typeof NO_ACCOUNT> {
    return db.transaction(async (tx) => {
      const locked = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .for("update");
      if (locked.length === 0) {
        return NO_ACCOUNT;
      }
      return work(tx);
    });
  }

  return {
    accountId,

    logs: {
      /**
       * Sync: entries changed after `afterRev`, oldest change first, at most `limit` of them.
       * One statement, so it reads one consistent picture of the table. `latestRev` comes from the
       * rows this statement saw, never from the counter: the counter can be ahead of rows that
       * are still being written, and a phone told that number would skip them.
       */
      async changesSince(afterRev: number, limit: number): Promise<LogChanges> {
        const rows = await db
          .select()
          .from(tummyLogs)
          .where(ownLog(gt(tummyLogs.rev, afterRev)))
          .orderBy(asc(tummyLogs.rev))
          .limit(limit + 1);
        const entries = rows.slice(0, limit);
        return {
          entries,
          latestRev: entries.at(-1)?.rev ?? afterRev,
          more: rows.length > limit,
        };
      },

      /** Entries changed after `afterRev` (0 for all), oldest change first. */
      list(afterRev = 0): Promise<TummyLog[]> {
        return db
          .select()
          .from(tummyLogs)
          .where(ownLog(gt(tummyLogs.rev, afterRev)))
          .orderBy(asc(tummyLogs.rev));
      },

      async get(id: string): Promise<TummyLog | undefined> {
        const rows = await db
          .select()
          .from(tummyLogs)
          .where(ownLog(eq(tummyLogs.id, id)))
          .limit(1);
        return rows[0];
      },

      /** Adds an entry for this account, under the account lock. The counter stamps its rev. */
      async insert(values: NewTummyLog): Promise<TummyLog> {
        const row = await lockedLogWrite(async (tx) => {
          const rows = await tx
            .insert(tummyLogs)
            .values({
              id: values.id,
              startedAt: values.startedAt,
              durationSeconds: values.durationSeconds,
              accountId,
              rev: nextRev,
            })
            .returning();
          return rows[0];
        });
        if (row === NO_ACCOUNT || row === undefined) {
          throw new Error("Insert stored no row.");
        }
        return row;
      },

      /**
       * PUT /api/logs/:id. Creates the entry, or replaces it if this account already has it, and
       * brings it back if it was deleted ("undo"). Every call is a new write with a new rev, so
       * the last write to reach the server wins (ADR 0005).
       *
       * One statement does both halves: INSERT, or on an ID that already exists, UPDATE. The
       * UPDATE half has its own account filter, so an ID that belongs to another account is
       * left untouched, no row comes back, and the answer is not_found.
       */
      async put(values: NewTummyLog, now: Date): Promise<LogWriteResult> {
        const result = await lockedLogWrite(async (tx): Promise<LogWriteResult> => {
          const rows = await tx
            .insert(tummyLogs)
            .values({
              id: values.id,
              accountId,
              startedAt: values.startedAt,
              durationSeconds: values.durationSeconds,
              rev: nextRev,
              updatedAt: now,
              deletedAt: null,
            })
            .onConflictDoUpdate({
              target: tummyLogs.id,
              set: {
                startedAt: sql`excluded.started_at`,
                durationSeconds: sql`excluded.duration_seconds`,
                rev: sql`excluded.rev`,
                updatedAt: sql`excluded.updated_at`,
                deletedAt: null,
              },
              setWhere: eq(tummyLogs.accountId, accountId),
            })
            .returning();
          const entry = rows[0];
          return entry ? { outcome: "written", entry } : { outcome: "not_found" };
        });
        return result === NO_ACCOUNT ? { outcome: "no_account" } : result;
      },

      /**
       * DELETE /api/logs/:id. Marks the entry deleted with a new rev, so the delete reaches the
       * other phones. Deleting an entry that is already deleted changes nothing and answers
       * "unchanged" with the entry, so a resent delete is harmless.
       */
      async markDeleted(id: string, now: Date): Promise<LogWriteResult> {
        const result = await lockedLogWrite(async (tx): Promise<LogWriteResult> => {
          const rows = await tx
            .update(tummyLogs)
            .set({ deletedAt: now, rev: nextRev, updatedAt: now })
            .where(ownLog(and(eq(tummyLogs.id, id), isNull(tummyLogs.deletedAt))))
            .returning();
          const written = rows[0];
          if (written) {
            return { outcome: "written", entry: written };
          }
          const existing = await tx
            .select()
            .from(tummyLogs)
            .where(ownLog(eq(tummyLogs.id, id)))
            .limit(1);
          const entry = existing[0];
          return entry ? { outcome: "unchanged", entry } : { outcome: "not_found" };
        });
        return result === NO_ACCOUNT ? { outcome: "no_account" } : result;
      },

      /**
       * Changes one of this account's entries and stamps it with the next rev. Returns undefined
       * when the entry does not exist for this account, including when another account owns it.
       */
      async update(id: string, changes: TummyLogChanges): Promise<TummyLog | undefined> {
        const row = await lockedLogWrite(async (tx) => {
          const rows = await tx
            .update(tummyLogs)
            .set({
              ...(changes.startedAt !== undefined && { startedAt: changes.startedAt }),
              ...(changes.durationSeconds !== undefined && {
                durationSeconds: changes.durationSeconds,
              }),
              ...(changes.deletedAt !== undefined && { deletedAt: changes.deletedAt }),
              rev: nextRev,
              updatedAt: sql`now()`,
            })
            .where(ownLog(eq(tummyLogs.id, id)))
            .returning();
          return rows[0];
        });
        return row === NO_ACCOUNT ? undefined : row;
      },
    },

    sessions: {
      list(): Promise<Session[]> {
        return db.select().from(sessions).where(ownSession());
      },

      /** Starts a session (a signed-in phone) for this account. Only the token's hash is kept. */
      async create(values: NewSession): Promise<void> {
        await db.insert(sessions).values({
          idHash: values.idHash,
          accountId,
          createdAt: values.createdAt,
          lastSeenAt: values.createdAt,
          expiresAt: values.expiresAt,
        });
      },

      /** Sessions that are still good: not past their end, and used since `seenAfter`. */
      async countActive(now: Date, seenAfter: Date): Promise<number> {
        const rows = await db
          .select({ n: count() })
          .from(sessions)
          .where(ownSession(and(gt(sessions.expiresAt, now), gt(sessions.lastSeenAt, seenAfter))));
        return rows[0]?.n ?? 0;
      },

      /** Ends one of this account's sessions ("sign out" on this phone). */
      async deleteOne(idHash: string): Promise<void> {
        await db.delete(sessions).where(ownSession(eq(sessions.idHash, idHash)));
      },

      /** Ends every session of this account ("sign out everywhere"). Returns how many. */
      async deleteAll(): Promise<number> {
        const rows = await db
          .delete(sessions)
          .where(ownSession())
          .returning({ idHash: sessions.idHash });
        return rows.length;
      },
    },

    /**
     * Deletes this account for good, in one transaction: its tummy logs, its sessions and the
     * account itself. Its audit events stay, unlinked (account_id becomes null), with an
     * account_deleted event among them, for the audit retention period (docs/data-map.md).
     */
    async deleteAccount(): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.insert(auditEvents).values({ type: "account_deleted", accountId });
        await tx.delete(tummyLogs).where(eq(tummyLogs.accountId, accountId));
        await tx.delete(sessions).where(eq(sessions.accountId, accountId));
        await tx.delete(accounts).where(eq(accounts.id, accountId));
      });
    },

    audit: {
      async record(type: AuditEventType): Promise<void> {
        await db.insert(auditEvents).values({ type, accountId });
      },

      list(): Promise<AuditEvent[]> {
        return db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.accountId, accountId))
          .orderBy(asc(auditEvents.createdAt));
      },
    },
  };
}

export type AccountScope = ReturnType<typeof forAccount>;
