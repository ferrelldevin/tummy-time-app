import { describe, expect, it } from "vitest";
import { en } from "./en";
import { countSyllables, gradeLevel } from "./readability";

/** Collects every string in the catalog, with its key path. */
function leaves(value: unknown, path = "en"): [string, string][] {
  if (typeof value === "string") {
    return [[path, value]];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  }
  return [];
}

// Not caregiver reading: the product name.
const skip = new Set(["en.appName"]);
const caregiverText = leaves(en).filter(([path]) => !skip.has(path));

/** Makes each string a sentence so labels such as "Home" count as one. */
const asSentence = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

describe("reading level (approximate Flesch-Kincaid)", () => {
  it("counts syllables sensibly", () => {
    expect(countSyllables("baby")).toBe(2);
    expect(countSyllables("tummy")).toBe(2);
    expect(countSyllables("time")).toBe(1);
    expect(countSyllables("reviewed")).toBe(2);
  });

  it("scores a hard sentence higher than a plain one", () => {
    const plain = gradeLevel("Pick what you need right now.");
    const hard = gradeLevel(
      "Notwithstanding considerable environmental complications, administrators reconsidered.",
    );
    expect(hard).toBeGreaterThan(plain + 5);
  });

  it("all caregiver text together scores at 8th grade or lower", () => {
    const corpus = caregiverText.map(([, s]) => asSentence(s)).join(" ");
    expect(gradeLevel(corpus)).toBeLessThanOrEqual(8);
  });

  it("every sentence-length string (5 or more words) scores at 8th grade or lower", () => {
    for (const [path, text] of caregiverText) {
      if (text.split(/\s+/).length >= 5) {
        expect(gradeLevel(asSentence(text)), path).toBeLessThanOrEqual(8);
      }
    }
  });
});
