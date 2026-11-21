import { en } from "../strings/en";
import { correctedAge, weeksToMonths } from "./corrected-age";
import type { Profile } from "./store";

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}

/** The corrected age as words, for the plan card and the home chip. */
export function correctedAgeText(profile: Profile): { short: string | null; long: string } {
  const result = correctedAge(profile.age, profile.born);
  switch (result.kind) {
    case "not-needed":
      return { short: null, long: en.plan.correctedNotNeeded };
    case "unknown":
      return { short: null, long: en.plan.correctedUnknown };
    case "before-due-date":
      return { short: null, long: en.plan.correctedBeforeDue };
    case "range": {
      // Under about 2 months, weeks are clearer than "0 to 1 months".
      const range =
        result.maxWeeks < 9
          ? fill(en.plan.weeksRange, { min: result.minWeeks, max: result.maxWeeks })
          : fill(en.plan.monthsRange, {
              min: weeksToMonths(result.minWeeks),
              max: weeksToMonths(result.maxWeeks),
            });
      return { short: range, long: fill(en.plan.correctedRange, { range }) };
    }
  }
}

export { fill };
