import { describe, expect, it } from "vitest";
import { lastSevenDays } from "./week";

describe("lastSevenDays", () => {
  const now = new Date(2026, 10, 20, 15, 0);
  it("has 7 days ending today, oldest first, all zero with no entries", () => {
    const days = lastSevenDays([], now);
    expect(days).toHaveLength(7);
    expect(days.at(-1)?.key).toBe("2026-11-20");
    expect(days[0]?.key).toBe("2026-11-14");
    expect(days.every((d) => d.seconds === 0)).toBe(true);
  });

  it("adds up each day and skips deleted and older entries", () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
    const days = lastSevenDays(
      [
        { startedAt: at(20, 9), durationSeconds: 120, deletedAt: null },
        { startedAt: at(20, 14), durationSeconds: 180, deletedAt: null },
        { startedAt: at(19, 9), durationSeconds: 60, deletedAt: "2026-11-19T10:00:00Z" },
        { startedAt: at(10, 9), durationSeconds: 600, deletedAt: null },
      ],
      now,
    );
    expect(days.at(-1)?.seconds).toBe(300);
    expect(days.at(-2)?.seconds).toBe(0);
    expect(days.reduce((s, d) => s + d.seconds, 0)).toBe(300);
  });
});
