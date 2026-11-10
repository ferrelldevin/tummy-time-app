import { createHmac, randomInt } from "node:crypto";
import {
  FAMILY_CODE_ALPHABET,
  FAMILY_CODE_LENGTH,
  isWellFormedFamilyCode,
  normalizeFamilyCode,
} from "@tummy/shared";

/**
 * Family codes (ADR 0003). No cryptography is written here: randomInt and createHmac are
 * Node's own (node:crypto, backed by OpenSSL).
 */

/**
 * A new family code: 12 characters from the 31-character alphabet, from the system's secure
 * random source. crypto.randomInt draws each character evenly (it rejects and redraws values
 * that would make some characters likelier), so there is no modulo bias.
 */
export function generateFamilyCode(): string {
  let code = "";
  for (let i = 0; i < FAMILY_CODE_LENGTH; i += 1) {
    code += FAMILY_CODE_ALPHABET.charAt(randomInt(FAMILY_CODE_ALPHABET.length));
  }
  return code;
}

/**
 * The keyed hash stored as accounts.code_lookup: lowercase hex HMAC-SHA-256 of the normalized
 * code with the server secret. The same code always gives the same value, so the account can be
 * found; without the secret, a stolen database does not let anyone test guesses.
 */
export function codeLookup(secret: Buffer, normalizedCode: string): string {
  return createHmac("sha256", secret).update(normalizedCode, "utf8").digest("hex");
}

/** Normalizes what was typed. Returns null when it cannot be a family code at all. */
export function readFamilyCode(input: string): string | null {
  const normalized = normalizeFamilyCode(input);
  return isWellFormedFamilyCode(normalized) ? normalized : null;
}
