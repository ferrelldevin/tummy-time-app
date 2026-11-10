import { randomBytes } from "node:crypto";
import argon2 from "argon2";

/**
 * PIN hashing with Argon2id (ADR 0003, threat model #3). The hashing itself is the argon2
 * library's (the reference implementation); nothing here is our own cryptography.
 *
 * Parameters: 46 MiB of memory, 2 passes, 1 lane. The OWASP Password Storage Cheat Sheet's
 * minimum for Argon2id is 19 MiB with 2 passes, or 46 MiB with 1 pass; this is above both.
 * One check takes about 85 ms on a 4-core development machine. Checks run on Node's worker
 * thread pool (4 threads by default), so at most about 4 x 46 MiB is in use at once.
 * Each hash carries its own random salt and its parameters, so they can be raised later and
 * old hashes still check.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 47_104,
  timeCost: 2,
  parallelism: 1,
} as const;

export interface PinHasher {
  hash(pin: string): Promise<string>;
  /** True when the PIN matches. Never throws for a wrong PIN or a malformed hash. */
  verify(hash: string, pin: string): Promise<boolean>;
  /**
   * Does one full check against a hash made at start-up that no PIN matches. Used when a family
   * code matches no account, so that path costs the same as a wrong PIN (threat model #2).
   */
  verifyDummy(pin: string): Promise<false>;
}

export async function createPinHasher(): Promise<PinHasher> {
  // A hash of 32 random bytes nobody knows, made with the same parameters as real ones.
  const dummyHash = await argon2.hash(randomBytes(32), ARGON2_OPTIONS);
  const verify = async (hash: string, pin: string): Promise<boolean> => {
    try {
      return await argon2.verify(hash, pin);
    } catch {
      return false;
    }
  };
  return {
    hash: (pin) => argon2.hash(pin, ARGON2_OPTIONS),
    verify,
    async verifyDummy(pin) {
      await verify(dummyHash, pin);
      return false;
    },
  };
}
