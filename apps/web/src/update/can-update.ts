/**
 * THE STALE-CONTENT RULE (threat model #17), the part that decides WHEN.
 *
 * Lessons and the "when to call" card are built into the app's files, so a phone shows new
 * wording only after it switches to the new version, and switching means reloading the page.
 * A phone must not keep old medical text longer than it has to, but a reload must never cost a
 * caregiver anything. So a waiting new version is applied by itself only at a safe moment
 * (the app starts, comes back to the front, or the person moves to another screen) and only
 * when this answers true.
 */
export interface UpdateSafety {
  /** A tummy time is being timed. The timer lives in memory: a reload would lose it. */
  timerRunning: boolean;
  /** A change is being saved on this phone, or a send to the server is under way. */
  saving: boolean;
  /** Changes in the outbox that the server has not taken yet. */
  unsent: number;
  /** The outbox could be sent now: the phone is online and the server answered last time. */
  canSend: boolean;
  /** A form field on the screen holds text the person typed and has not saved. */
  typedText: boolean;
}

/**
 * True when a waiting update may be applied (the page reloaded) without asking.
 *
 * - Never under a running timer.
 * - Never in the middle of a save or a send.
 * - Never over text someone typed.
 * - Unsent changes are safe in IndexedDB across a reload. But if they could be sent right now,
 *   let them go first; if they cannot be sent anyway (offline, or the server is unreachable),
 *   waiting gains nothing.
 */
export function canUpdateNow(state: UpdateSafety): boolean {
  if (state.timerRunning) return false;
  if (state.saving) return false;
  if (state.typedText) return false;
  if (state.unsent > 0 && state.canSend) return false;
  return true;
}

/**
 * When the person presses "Update now", what still has to wait, or null for nothing. They asked,
 * so typed text and unsent changes (kept in IndexedDB) do not hold it back. A running timer
 * always does, and a save under way finishes first.
 */
export function whatHoldsUpdate(state: UpdateSafety): "timer" | "saving" | null {
  if (state.timerRunning) return "timer";
  if (state.saving) return "saving";
  return null;
}
