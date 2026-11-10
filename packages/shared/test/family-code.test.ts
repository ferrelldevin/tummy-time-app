import { describe, expect, it } from "vitest";
import {
  FAMILY_CODE_ALPHABET,
  FAMILY_CODE_LENGTH,
  formatFamilyCode,
  isWellFormedFamilyCode,
  normalizeFamilyCode,
  PIN_PATTERN,
} from "../src/index.js";

describe("family code rules", () => {
  it("the alphabet has no look-alike characters and no repeats", () => {
    for (const lookAlike of ["0", "O", "1", "I", "L"]) {
      expect(FAMILY_CODE_ALPHABET).not.toContain(lookAlike);
    }
    expect(new Set(FAMILY_CODE_ALPHABET).size).toBe(FAMILY_CODE_ALPHABET.length);
    expect(FAMILY_CODE_ALPHABET).toMatch(/^[2-9A-Z]+$/);
    // About 60 bits (ADR 0003).
    expect(FAMILY_CODE_LENGTH * Math.log2(FAMILY_CODE_ALPHABET.length)).toBeGreaterThan(59);
  });

  it.each([
    ["ABCD EFGH JKMN", "ABCDEFGHJKMN"],
    ["abcd-efgh-jkmn", "ABCDEFGHJKMN"],
    ["  abcd efgh\tjkmn ", "ABCDEFGHJKMN"],
    ["ABCD–EFGH—JKMN", "ABCDEFGHJKMN"],
    ["ABCD EFGH JKMN", "ABCDEFGHJKMN"],
  ])("normalizes %j", (input, expected) => {
    expect(normalizeFamilyCode(input)).toBe(expected);
    expect(isWellFormedFamilyCode(normalizeFamilyCode(input))).toBe(true);
  });

  it.each(["ABCDEFGHJKM", "ABCDEFGHJKMNP", "ABCDEFGHJKM0", "ABCDEFGHJKMO", "ABCDEFGHJKMI", ""])(
    "refuses %j",
    (code) => {
      expect(isWellFormedFamilyCode(code)).toBe(false);
    },
  );

  it("shows a code as three groups of four", () => {
    expect(formatFamilyCode("ABCDEFGHJKMN")).toBe("ABCD EFGH JKMN");
  });

  it("a PIN is exactly six digits", () => {
    expect(PIN_PATTERN.test("482916")).toBe(true);
    for (const bad of ["48291", "4829160", "48291a", " 482916", "４８２９１６"]) {
      expect(PIN_PATTERN.test(bad), bad).toBe(false);
    }
  });
});
