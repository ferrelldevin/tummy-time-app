import { forAccount, type AccountId } from "../db/account-scope.js";
import type { Db } from "../db/client.js";
import type { Clock } from "./clock.js";
import { credentialStore, MAX_FAILED_ATTEMPTS, type AttemptTarget } from "./credential-store.js";
import type { PinHasher } from "./pin-hash.js";

/**
 * Checks a PIN with the lockout rules (ADR 0003, threat model #1 and #2):
 * - 5 wrong PINs in a row lock the account for 15 minutes;
 * - while locked, even the right PIN is refused;
 * - a right PIN clears the count.
 *
 * Used by sign-in (the account is found by its family code) and by account deletion (the
 * signed-in account, by ID), so both share one count.
 *
 * An unknown family code costs the same as a wrong PIN: one full Argon2id check (against the
 * start-up dummy hash), one failed-sign-in audit event, and the same answer, "failed".
 */

export const LOCK_DURATION_MS = 15 * 60 * 1000;
export { MAX_FAILED_ATTEMPTS };

export type PinCheckResult =
  { outcome: "ok"; accountId: AccountId } | { outcome: "failed" } | { outcome: "locked" };

export function pinChecker(db: Db, hasher: PinHasher, clock: Clock) {
  const store = credentialStore(db);
  return async function checkPin(target: AttemptTarget, pin: string): Promise<PinCheckResult> {
    const reservation = await store.reserveAttempt(target, clock.now());

    if (reservation.kind === "unknown") {
      await hasher.verifyDummy(pin);
      await store.recordUnknownCodeAttempt();
      return { outcome: "failed" };
    }

    const scope = forAccount(db, reservation.accountId);
    if (reservation.kind === "locked") {
      await scope.audit.record("sign_in_failed");
      return { outcome: "locked" };
    }

    if (await hasher.verify(reservation.pinHash, pin)) {
      await store.clearAttempts(reservation.accountId);
      return { outcome: "ok", accountId: reservation.accountId };
    }

    await scope.audit.record("sign_in_failed");
    if (reservation.attempt >= MAX_FAILED_ATTEMPTS) {
      const until = new Date(clock.now().getTime() + LOCK_DURATION_MS);
      if (await store.lockIfAtLimit(reservation.accountId, until)) {
        await scope.audit.record("lockout");
      }
    }
    return { outcome: "failed" };
  };
}

export type CheckPin = ReturnType<typeof pinChecker>;
