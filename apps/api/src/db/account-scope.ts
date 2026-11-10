import { and, asc, count, eq, gt, sql, type SQL } from "drizzle-orm";
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
 * The accounts table is used here for one thing only: deleting this account for good.
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

/** The next number from the one rev counter (ADR 0005). */
const nextRev = sql<number>`nextval('tummy_logs_rev_seq')`;

export interface NewSession {
  idHash: string;
  createdAt: Date;
  expiresAt: Date;
}

export function forAccount(db: Queryable, accountId: AccountId) {
  const ownLog = (extra?: SQL) => and(eq(tummyLogs.accountId, accountId), extra);
  const ownSession = (extra?: SQL) => and(eq(sessions.accountId, accountId), extra);

  return {
    accountId,

    logs: {
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

      /** Adds an entry for this account. The counter stamps its rev. */
      async insert(values: NewTummyLog): Promise<TummyLog> {
        const rows = await db
          .insert(tummyLogs)
          .values({
            id: values.id,
            startedAt: values.startedAt,
            durationSeconds: values.durationSeconds,
            accountId,
          })
          .returning();
        const row = rows[0];
        if (row === undefined) {
          throw new Error("Insert returned no row.");
        }
        return row;
      },

      /**
       * Changes one of this account's entries and stamps it with the next rev. Returns undefined
       * when the entry does not exist for this account, including when another account owns it.
       */
      async update(id: string, changes: TummyLogChanges): Promise<TummyLog | undefined> {
        const rows = await db
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
