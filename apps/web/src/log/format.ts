import { en, locale } from "../strings/en";

const t = en.log;

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** A length in plain words: "45 seconds", "1 minute", "5 minutes 30 seconds". */
export function lengthText(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const minutes = m === 1 ? t.minuteOne : fill(t.minutesMany, { n: String(m) });
  const secs = s === 1 ? t.secondOne : fill(t.secondsMany, { n: String(s) });
  if (m === 0) return secs;
  if (s === 0) return minutes;
  return `${minutes} ${secs}`;
}

/** A running time as a clock face shows it: "0:05", "12:40", "1:02:03". */
export function clockText(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${String(h)}:${String(m).padStart(2, "0")}:${ss}` : `${String(m)}:${ss}`;
}

const timeFormat = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(locale, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

/** A time of day on this phone's clock: "9:05 AM". */
export function timeOfDayText(date: Date): string {
  return timeFormat.format(date);
}

/** The phone's own calendar day of a time, as "2026-11-10". Used to group entries by day. */
export function localDayKey(date: Date): string {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A day heading: "Today", "Yesterday", or "Monday, November 9". */
export function dayHeading(date: Date, now: Date): string {
  const key = localDayKey(date);
  if (key === localDayKey(now)) return t.today;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDayKey(yesterday)) return t.yesterday;
  return dayFormat.format(date);
}

/** "9:05 AM, 5 minutes": how one entry is named on buttons and in messages. */
export function entryText(startedAt: Date, durationSeconds: number): string {
  return fill(t.entry, { time: timeOfDayText(startedAt), length: lengthText(durationSeconds) });
}

export { fill };
