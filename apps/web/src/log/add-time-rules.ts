import { LOG_MAX_AGE_MS, LOG_MAX_FUTURE_MS, type PutLogBody } from "@tummy/shared";
import { en } from "../strings/en";

const errors = en.addTime.errors;

export const MAX_MINUTES = 120;

export interface AddTimeInput {
  /** "2026-11-10", from <input type="date">. */
  day: string;
  /** "09:05", from <input type="time">. */
  time: string;
  minutes: string;
}

export type AddTimeErrors = Partial<Record<keyof AddTimeInput, string>>;

/**
 * Checks the "Add a time" form against the same limits the server uses, with words a caregiver
 * can act on. The day and time are read on this phone's own clock and time zone.
 */
export function checkAddTime(
  input: AddTimeInput,
  now: Date,
): { ok: true; body: PutLogBody } | { ok: false; errors: AddTimeErrors } {
  const found: AddTimeErrors = {};
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.day.trim());
  const time = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(input.time.trim());
  const minutesText = input.minutes.trim();
  if (!day) found.day = errors.dayMissing;
  if (!time) found.time = errors.timeMissing;
  if (minutesText === "") found.minutes = errors.minutesMissing;
  else if (
    !/^\d{1,3}$/.test(minutesText) ||
    Number(minutesText) < 1 ||
    Number(minutesText) > MAX_MINUTES
  ) {
    found.minutes = errors.minutesShape;
  }
  if (!day || !time) return { ok: false, errors: found };

  const startedAt = new Date(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    Number(time[1]),
    Number(time[2]),
  );
  if (Number.isNaN(startedAt.getTime())) {
    found.day = errors.dayMissing;
  } else if (startedAt.getTime() > now.getTime() + LOG_MAX_FUTURE_MS) {
    found.time = errors.future;
  } else if (startedAt.getTime() < now.getTime() - LOG_MAX_AGE_MS) {
    found.day = errors.tooOld;
  }
  if (Object.keys(found).length > 0) return { ok: false, errors: found };
  return {
    ok: true,
    body: { startedAt: startedAt.toISOString(), durationSeconds: Number(minutesText) * 60 },
  };
}
