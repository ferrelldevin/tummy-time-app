import { localDayKey } from "./format";

export interface DayTotal {
  key: string;
  date: Date;
  seconds: number;
}

/**
 * The last 7 days on this phone's calendar, oldest first, with the total tummy time of each.
 * Entries deleted on this phone and not yet confirmed are left out, as on the log list.
 */
export function lastSevenDays(
  entries: readonly { startedAt: string; durationSeconds: number; deletedAt: string | null }[],
  now: Date,
): DayTotal[] {
  const days: DayTotal[] = [];
  for (let back = 6; back >= 0; back -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    days.push({ key: localDayKey(date), date, seconds: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const e of entries) {
    if (e.deletedAt !== null) continue;
    const day = byKey.get(localDayKey(new Date(e.startedAt)));
    if (day) day.seconds += e.durationSeconds;
  }
  return days;
}
