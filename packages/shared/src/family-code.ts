/**
 * Family code and PIN rules, shared by the web app and the API so both read a code the same way.
 * ADR 0003. The API makes the codes (apps/api/src/auth/family-code.ts); nothing here is secret.
 */

/**
 * 31 characters with no look-alikes: no 0 or O, no 1, I or L. 12 of them carry
 * 12 x log2(31) = about 59.4 bits, the "about 60 bits" in ADR 0003.
 */
export const FAMILY_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const FAMILY_CODE_LENGTH = 12;
export const FAMILY_CODE_GROUP = 4;

/** Longest family code input accepted before normalizing: 12 characters plus spacing and dashes. */
export const FAMILY_CODE_INPUT_MAX = 40;

const WELL_FORMED = new RegExp(`^[${FAMILY_CODE_ALPHABET}]{${String(FAMILY_CODE_LENGTH)}}$`);

/**
 * What a person typed, made comparable: spaces and dashes removed, letters made uppercase.
 * "abcd-efgh jkmn" and "ABCDEFGHJKMN" are the same code.
 */
export function normalizeFamilyCode(input: string): string {
  // Any kind of space, and the dashes a phone keyboard or a copy and paste may produce.
  return input.replace(/[\s\-‐-―−]/gu, "").toUpperCase();
}

/** True when a normalized code has the right length and only allowed characters. */
export function isWellFormedFamilyCode(normalized: string): boolean {
  return WELL_FORMED.test(normalized);
}

/** "ABCDEFGHJKMN" -> "ABCD EFGH JKMN", three groups of four, for showing on screen. */
export function formatFamilyCode(normalized: string): string {
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += FAMILY_CODE_GROUP) {
    groups.push(normalized.slice(i, i + FAMILY_CODE_GROUP));
  }
  return groups.join(" ");
}

/** A PIN is exactly 6 digits (0 to 9). */
export const PIN_LENGTH = 6;
export const PIN_PATTERN = /^[0-9]{6}$/;

/**
 * Every request that changes something must carry this header (ADR 0004, threat model #5).
 * A plain HTML form on another site cannot add a custom header, and a script on another site
 * cannot add one to a request to us without our permission, which the API never gives.
 */
export const API_REQUEST_HEADER = "x-tummy-request";
export const API_REQUEST_HEADER_VALUE = "1";
