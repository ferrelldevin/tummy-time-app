/**
 * DEMO BUILD ONLY. A made-up week of tummy time for the sample family, so the log and its week
 * chart have something to show. Not from any real baby. Times are placed relative to "now" so
 * the week always ends today.
 */

/** Days ago, hour of day (24 h), minutes long. Small and growing, the way the lessons describe. */
const PLAN: readonly (readonly [number, number, number])[] = [
  [6, 9, 2],
  [6, 16, 3],
  [5, 10, 3],
  [5, 18, 2],
  [4, 9, 4],
  [4, 13, 3],
  [3, 11, 5],
  [3, 17, 4],
  [2, 9, 5],
  [2, 14, 6],
  [1, 10, 6],
  [1, 15, 5],
  [1, 19, 4],
];

function idFor(n: number): string {
  const tail = n.toString(16).padStart(12, "0");
  return `0d3e5a10-0000-4000-8000-${tail}`;
}

export function sampleWeek(
  now: Date,
): { id: string; startedAt: string; durationSeconds: number }[] {
  return PLAN.map(([daysAgo, hour, minutes], i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, (i * 7) % 60, 0, 0);
    return { id: idFor(i + 1), startedAt: d.toISOString(), durationSeconds: minutes * 60 };
  });
}
