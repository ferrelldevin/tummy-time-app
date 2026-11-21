/**
 * Corrected age from the two "Getting started" answers. Both answers are RANGES on purpose: the
 * app never asks for a birth date (no personal information). So the answer is a range too.
 *
 * Corrected age = age since birth minus weeks born early (style guide: "corrected age").
 * The definition of done says this math keeps its own tests: corrected-age.test.ts.
 */

export const ageChoices = ["0-1m", "1-2m", "2-4m", "4-6m", "6m-plus"] as const;
export type AgeChoice = (typeof ageChoices)[number];

export const bornChoices = ["on-time", "34-36", "28-33", "before-28", "not-sure"] as const;
export type BornChoice = (typeof bornChoices)[number];

/** Age since birth, in whole weeks: [youngest, oldest] for each answer. */
const AGE_WEEKS: Record<AgeChoice, readonly [number, number]> = {
  "0-1m": [0, 4],
  "1-2m": [4, 9],
  "2-4m": [9, 17],
  "4-6m": [17, 26],
  "6m-plus": [26, 52],
};

/**
 * Weeks born early: [fewest, most]. A full-term pregnancy is counted as 40 weeks, so a baby
 * born at 34 to 36 weeks was born 4 to 6 weeks early. "Before 28" stops at 17 weeks early
 * (born at 23 weeks), the earliest that is commonly reported.
 */
const EARLY_WEEKS: Record<Exclude<BornChoice, "not-sure">, readonly [number, number]> = {
  "on-time": [0, 3],
  "34-36": [4, 6],
  "28-33": [7, 12],
  "before-28": [13, 17],
};

export type CorrectedAge =
  /** Born at or near term: corrected age is not needed. */
  | { kind: "not-needed" }
  /** "Not sure" how early: we cannot work it out. */
  | { kind: "unknown" }
  /** Every possible answer is before the due date. */
  | { kind: "before-due-date" }
  /** A range in whole weeks. `min` may be 0 when the baby may not be past the due date yet. */
  | { kind: "range"; minWeeks: number; maxWeeks: number };

export function correctedAge(age: AgeChoice, born: BornChoice): CorrectedAge {
  if (born === "not-sure") return { kind: "unknown" };
  if (born === "on-time") return { kind: "not-needed" };
  const [ageMin, ageMax] = AGE_WEEKS[age];
  const [earlyMin, earlyMax] = EARLY_WEEKS[born];
  const max = ageMax - earlyMin;
  if (max <= 0) return { kind: "before-due-date" };
  return { kind: "range", minWeeks: Math.max(0, ageMin - earlyMax), maxWeeks: max };
}

/** Whole months from weeks, rounded down (a month is 52 / 12 weeks). */
export function weeksToMonths(weeks: number): number {
  return Math.floor((weeks * 12) / 52);
}
