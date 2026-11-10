import { afterEach, describe, expect, it } from "vitest";
import { LOG_MAX_AGE_MS } from "@tummy/shared";
import { en } from "../strings/en";
import { checkAddTime } from "./add-time-rules";
import { clockText, dayHeading, entryText, lengthText, localDayKey } from "./format";
import { elapsedSeconds, timer } from "./timer";

afterEach(() => {
  timer.stop(0);
});

describe("timer maths", () => {
  it("works out the time from the start time, not by counting ticks", () => {
    const start = 1_000_000;
    timer.start(start);
    // However few redraws happened (a background tab may get one a minute), the answer is the
    // difference of the two times.
    expect(elapsedSeconds(start, start + 999)).toBe(0);
    expect(elapsedSeconds(start, start + 1000)).toBe(1);
    expect(elapsedSeconds(start, start + 61 * 60_000 + 30_400)).toBe(3690);
    const done = timer.stop(start + 5 * 60_000 + 250);
    expect(done).toEqual({ startedAtMs: start, elapsedMs: 300_250 });
  });

  it("never goes below zero if the phone's clock moves back", () => {
    expect(elapsedSeconds(10_000, 4_000)).toBe(0);
    timer.start(10_000);
    expect(timer.stop(4_000)?.elapsedMs).toBe(0);
  });

  it("a second Start while running keeps the first start time; Stop when stopped does nothing", () => {
    timer.start(1000);
    timer.start(9000);
    expect(timer.get().startedAtMs).toBe(1000);
    timer.stop(2000);
    expect(timer.get().startedAtMs).toBeNull();
    expect(timer.stop(3000)).toBeNull();
  });

  it("says whether it is running, for the rule that never reloads under a timer", () => {
    expect(timer.isRunning()).toBe(false);
    timer.start(1000);
    expect(timer.isRunning()).toBe(true);
    timer.stop(2000);
    expect(timer.isRunning()).toBe(false);
  });

  it("tells whoever listens when it starts and stops", () => {
    const seen: (number | null)[] = [];
    const off = timer.subscribe(() => seen.push(timer.get().startedAtMs));
    timer.start(5);
    timer.stop(6);
    off();
    timer.start(7);
    expect(seen).toEqual([5, null]);
  });
});

describe("lengths and times in words", () => {
  it.each([
    [0, "0 seconds"],
    [1, "1 second"],
    [45, "45 seconds"],
    [60, "1 minute"],
    [61, "1 minute 1 second"],
    [300, "5 minutes"],
    [330, "5 minutes 30 seconds"],
    [7200, "120 minutes"],
  ])("%d seconds is %s", (seconds, text) => {
    expect(lengthText(seconds)).toBe(text);
  });

  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [760, "12:40"],
    [3723, "1:02:03"],
  ])("%d seconds on the clock face is %s", (seconds, text) => {
    expect(clockText(seconds)).toBe(text);
  });

  it("names days as Today, Yesterday, or the weekday and date", () => {
    const now = new Date(2026, 10, 10, 15, 0);
    expect(dayHeading(new Date(2026, 10, 10, 0, 5), now)).toBe(en.log.today);
    expect(dayHeading(new Date(2026, 10, 9, 23, 59), now)).toBe(en.log.yesterday);
    expect(dayHeading(new Date(2026, 10, 8, 9, 0), now)).toBe("Sunday, November 8");
    // The first of the month: "yesterday" is the last day of the month before.
    expect(dayHeading(new Date(2026, 9, 31, 9, 0), new Date(2026, 10, 1, 9, 0))).toBe(
      en.log.yesterday,
    );
  });

  it("groups by the phone's own calendar day", () => {
    expect(localDayKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("names an entry by its time and length", () => {
    expect(entryText(new Date(2026, 10, 10, 9, 5), 300)).toBe("9:05 AM, 5 minutes");
  });
});

describe('the "Add a time" checks', () => {
  const now = new Date(2026, 10, 10, 15, 0);
  const ok = { day: "2026-11-10", time: "09:05", minutes: "12" };
  const e = en.addTime.errors;

  it("turns the day, time and minutes into a start time and a length in seconds", () => {
    expect(checkAddTime(ok, now)).toEqual({
      ok: true,
      body: { startedAt: new Date(2026, 10, 10, 9, 5).toISOString(), durationSeconds: 720 },
    });
  });

  it("names each missing field", () => {
    expect(checkAddTime({ day: "", time: "", minutes: "" }, now)).toEqual({
      ok: false,
      errors: { day: e.dayMissing, time: e.timeMissing, minutes: e.minutesMissing },
    });
  });

  it.each([
    ["1", true],
    ["120", true],
    ["0", false],
    ["121", false],
    ["1.5", false],
    ["-3", false],
    ["ten", false],
  ])("minutes %s accepted: %s", (minutes, accepted) => {
    expect(checkAddTime({ ...ok, minutes }, now).ok).toBe(accepted);
  });

  it("refuses a time that has not happened yet, allowing the same 5 minutes as the server", () => {
    expect(checkAddTime({ ...ok, time: "15:05" }, now).ok).toBe(true);
    expect(checkAddTime({ ...ok, time: "15:06" }, now)).toEqual({
      ok: false,
      errors: { time: e.future },
    });
  });

  it("refuses a day more than a year ago", () => {
    const yearAgo = new Date(now.getTime() - LOG_MAX_AGE_MS);
    const day = localDayKey(new Date(yearAgo.getTime() - 24 * 60 * 60 * 1000));
    expect(checkAddTime({ ...ok, day }, now)).toEqual({ ok: false, errors: { day: e.tooOld } });
  });
});
