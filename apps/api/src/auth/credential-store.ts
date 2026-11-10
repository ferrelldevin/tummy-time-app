import { and, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { toAccountId, type AccountId } from "../db/account-scope.js";
import type { Queryable } from "../db/client.js";
import { accounts, auditEvents, sessions } from "../db/schema.js";

/**
 * THE QUERIES THAT RUN BEFORE ANYONE IS SIGNED IN (ADR 0008, "Reopen if"; threat model #8).
 *
 * Everything else that touches an account's rows goes through forAccount() in
 * src/db/account-scope.ts, which needs an account ID that a signed-in session proved. These
 * queries cannot: they are how that ID is found in the first place. So they live here, in one
 * file, and test/account-scope-guard.test.ts allows this file (and only this file) to use the
 * accounts, sessions and audit_events tables for exactly these jobs:
 *
 * - find an account by the keyed hash of its family code, and count a PIN attempt on it;
 * - create an account;
 * - lock an account, or clear its count after a right PIN;
 * - find, refresh or end a session by the hash of its token;
 * - write a failed-sign-in audit event that has no account (the code matched none).
 *
 * Nothing here returns a PIN hash to a route, and nothing here is reachable from a route
 * directly: src/auth/ calls it.
 */

/** Five wrong PINs in a row lock the account (ADR 0003). */
export const MAX_FAILED_ATTEMPTS = 5;

/** Which account a PIN attempt is for: by family code (sign-in) or by ID (delete account). */
export type AttemptTarget = { codeLookup: string } | { accountId: AccountId };

export type Reservation =
  | { kind: "reserved"; accountId: AccountId; pinHash: string; attempt: number }
  | { kind: "locked"; accountId: AccountId }
  | { kind: "unknown" };

export interface StoredSession {
  accountId: AccountId;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

function whereTarget(target: AttemptTarget) {
  return "codeLookup" in target
    ? eq(accounts.codeLookup, target.codeLookup)
    : eq(accounts.id, target.accountId);
}

export function credentialStore(db: Queryable) {
  return {
    /** Adds an account. Returns null when the code_lookup is already taken (a code collision). */
    async createAccount(codeLookup: string, pinHash: string): Promise<AccountId | null> {
      const rows = await db
        .insert(accounts)
        .values({ codeLookup, pinHash })
        .onConflictDoNothing({ target: accounts.codeLookup })
        .returning({ id: accounts.id });
      const id = rows[0]?.id;
      return id === undefined ? null : toAccountId(id);
    },

    /** The account a family code belongs to, without counting an attempt (dev-fake only). */
    async findAccountId(codeLookup: string): Promise<AccountId | null> {
      const rows = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.codeLookup, codeLookup))
        .limit(1);
      const id = rows[0]?.id;
      return id === undefined ? null : toAccountId(id);
    },

    /**
     * Counts a PIN attempt BEFORE the PIN is checked, in one UPDATE, so that parallel guesses
     * cannot get past the limit: each one must win a row from the database first, and the
     * database hands out at most MAX_FAILED_ATTEMPTS of them. The attempt is counted as wrong
     * until clearAttempts() says otherwise.
     *
     * The attempt that reaches the limit sets the lock in the same UPDATE. Counting and locking
     * are one step, so nothing that goes wrong afterwards (a crash, a lost connection) can leave
     * an account at the limit with no lock and so no time at which it opens again.
     *
     * A lock whose time has passed is lifted here, and the count starts again at 1.
     */
    async reserveAttempt(target: AttemptTarget, now: Date, lockUntil: Date): Promise<Reservation> {
      const lockOver = and(
        sql`${accounts.lockedUntil} IS NOT NULL`,
        lte(accounts.lockedUntil, now),
      );
      const rows = await db
        .update(accounts)
        .set({
          failedAttempts: sql`CASE WHEN ${lockOver} THEN 1 ELSE ${accounts.failedAttempts} + 1 END`,
          lockedUntil: sql`CASE WHEN NOT (${lockOver}) AND ${accounts.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS} THEN ${lockUntil.toISOString()}::timestamptz ELSE NULL END`,
        })
        .where(
          and(
            whereTarget(target),
            or(
              and(isNull(accounts.lockedUntil), lt(accounts.failedAttempts, MAX_FAILED_ATTEMPTS)),
              lockOver,
            ),
          ),
        )
        .returning({
          id: accounts.id,
          pinHash: accounts.pinHash,
          attempt: accounts.failedAttempts,
        });
      const row = rows[0];
      if (row) {
        return {
          kind: "reserved",
          accountId: toAccountId(row.id),
          pinHash: row.pinHash,
          attempt: row.attempt,
        };
      }
      // No row: either no such account, or it is locked.
      const existing = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(whereTarget(target))
        .limit(1);
      const id = existing[0]?.id;
      return id === undefined
        ? { kind: "unknown" }
        : { kind: "locked", accountId: toAccountId(id) };
    },

    /** After a right PIN: the count of wrong PINs in a row starts again. */
    async clearAttempts(accountId: AccountId): Promise<void> {
      await db
        .update(accounts)
        .set({ failedAttempts: 0, lockedUntil: null })
        .where(eq(accounts.id, accountId));
    },

    async findSession(idHash: string): Promise<StoredSession | undefined> {
      const rows = await db
        .select({
          accountId: sessions.accountId,
          createdAt: sessions.createdAt,
          lastSeenAt: sessions.lastSeenAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(eq(sessions.idHash, idHash))
        .limit(1);
      const row = rows[0];
      return row ? { ...row, accountId: toAccountId(row.accountId) } : undefined;
    },

    /** Ends one session, whichever account it belongs to. Knowing its token proves the right. */
    async deleteSession(idHash: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.idHash, idHash));
    },

    /** Records that the session was used. Only moves forward. */
    async touchSession(idHash: string, now: Date): Promise<void> {
      await db
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(and(eq(sessions.idHash, idHash), lt(sessions.lastSeenAt, now)));
    },

    /** A failed sign-in for a family code that matches no account: there is no account to name. */
    async recordUnknownCodeAttempt(): Promise<void> {
      await db.insert(auditEvents).values({ type: "sign_in_failed", accountId: null });
    },
  };
}

export type CredentialStore = ReturnType<typeof credentialStore>;
