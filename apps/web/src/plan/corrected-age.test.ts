import { describe, expect, it } from "vitest";
import { ageChoices, correctedAge, weeksToMonths } from "./corrected-age";

describe("corrected age", () => {
  it("is not needed for a baby born on time", () => {
    expect(correctedAge("2-4m", "on-time")).toEqual({ kind: "not-needed" });
  });

  it("is unknown when the caregiver is not sure how early", () => {
    expect(correctedAge("2-4m", "not-sure")).toEqual({ kind: "unknown" });
  });

  it("takes the weeks born early away from the age (both are ranges)", () => {
    // 9 to 17 weeks old, born 7 to 12 weeks early: 9-12 is below 0, so 0; 17-7 = 10.
    expect(correctedAge("2-4m", "28-33")).toEqual({ kind: "range", minWeeks: 0, maxWeeks: 10 });
    // 17 to 26 weeks old, born 4 to 6 weeks early: 11 to 22 weeks.
    expect(correctedAge("4-6m", "34-36")).toEqual({ kind: "range", minWeeks: 11, maxWeeks: 22 });
  });

  it("says before the due date when every answer would be below zero", () => {
    // 0 to 4 weeks old, born 13 to 17 weeks early: at most 4 - 13 = -9 weeks.
    expect(correctedAge("0-1m", "before-28")).toEqual({ kind: "before-due-date" });
    // Exactly at the due date at most (4 - 4 = 0) also counts as not past it.
    expect(correctedAge("0-1m", "34-36")).toEqual({ kind: "before-due-date" });
  });

  it("never gives a negative or reversed range for any pair of answers", () => {
    for (const age of ageChoices) {
      for (const born of ["34-36", "28-33", "before-28"] as const) {
        const result = correctedAge(age, born);
        if (result.kind === "range") {
          expect(result.minWeeks).toBeGreaterThanOrEqual(0);
          expect(result.maxWeeks).toBeGreaterThan(result.minWeeks);
        }
      }
    }
  });

  it("turns weeks into whole months, rounding down", () => {
    expect(weeksToMonths(0)).toBe(0);
    expect(weeksToMonths(4)).toBe(0);
    expect(weeksToMonths(5)).toBe(1);
    expect(weeksToMonths(26)).toBe(6);
    expect(weeksToMonths(52)).toBe(12);
  });
});
