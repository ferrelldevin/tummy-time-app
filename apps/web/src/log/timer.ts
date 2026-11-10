/**
 * The running tummy time timer. Kept in memory only, never stored: a reload or closing the app
 * loses a timer that is running (a known limit of this block). It lives in this module, not in a
 * screen, so it keeps running while the caregiver opens another screen, such as When to call.
 *
 * The time shown is always "now minus the start time", never a count of ticks, so it stays right
 * when the phone slows timers down in the background or the screen is off.
 */

export interface TimerState {
  /** When it started, in milliseconds since 1970, or null when it is not running. */
  startedAtMs: number | null;
}

let state: TimerState = { startedAtMs: null };
const listeners = new Set<() => void>();

function set(next: TimerState) {
  state = next;
  for (const listener of listeners) listener();
}

export const timer = {
  get: (): TimerState => state,
  /** True while a tummy time is being timed. The app never reloads itself then (src/update/). */
  isRunning: (): boolean => state.startedAtMs !== null,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  start: (nowMs: number): void => {
    if (state.startedAtMs === null) set({ startedAtMs: nowMs });
  },
  /** Stops the timer. Answers when it started and how long it ran, or null if it was not running. */
  stop: (nowMs: number): { startedAtMs: number; elapsedMs: number } | null => {
    const startedAtMs = state.startedAtMs;
    if (startedAtMs === null) return null;
    set({ startedAtMs: null });
    return { startedAtMs, elapsedMs: Math.max(0, nowMs - startedAtMs) };
  },
};

/** Whole seconds between the start and `nowMs`. Never negative, even if the clock moved back. */
export function elapsedSeconds(startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
}
