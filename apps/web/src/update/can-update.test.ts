import { describe, expect, it } from "vitest";
import { canUpdateNow, whatHoldsUpdate, type UpdateSafety } from "./can-update";

/** Nothing going on: the one state where every rule allows an update. */
const calm: UpdateSafety = {
  timerRunning: false,
  saving: false,
  unsent: 0,
  canSend: true,
  typedText: false,
};

describe("canUpdateNow: when a waiting update may reload the page without asking", () => {
  it("allows it when nothing is going on", () => {
    expect(canUpdateNow(calm)).toBe(true);
  });

  it("never under a running timer, whatever else is true", () => {
    expect(canUpdateNow({ ...calm, timerRunning: true })).toBe(false);
    expect(canUpdateNow({ ...calm, timerRunning: true, canSend: false })).toBe(false);
  });

  it("never in the middle of a save or a send", () => {
    expect(canUpdateNow({ ...calm, saving: true })).toBe(false);
    expect(canUpdateNow({ ...calm, saving: true, canSend: false })).toBe(false);
  });

  it("never over text someone typed", () => {
    expect(canUpdateNow({ ...calm, typedText: true })).toBe(false);
  });

  it("waits while unsent changes could be sent right now", () => {
    expect(canUpdateNow({ ...calm, unsent: 1, canSend: true })).toBe(false);
    expect(canUpdateNow({ ...calm, unsent: 3, canSend: true })).toBe(false);
  });

  it("does not wait for unsent changes that cannot be sent anyway (they stay in IndexedDB)", () => {
    expect(canUpdateNow({ ...calm, unsent: 2, canSend: false })).toBe(true);
  });

  it("an empty outbox does not care whether it could send", () => {
    expect(canUpdateNow({ ...calm, unsent: 0, canSend: false })).toBe(true);
  });
});

describe("whatHoldsUpdate: when the person pressed Update now", () => {
  it("nothing holds it when nothing is going on", () => {
    expect(whatHoldsUpdate(calm)).toBeNull();
  });

  it("a running timer always holds it", () => {
    expect(whatHoldsUpdate({ ...calm, timerRunning: true })).toBe("timer");
    expect(whatHoldsUpdate({ ...calm, timerRunning: true, saving: true })).toBe("timer");
  });

  it("a save under way finishes first", () => {
    expect(whatHoldsUpdate({ ...calm, saving: true })).toBe("saving");
  });

  it("typed text and unsent changes do not hold it: the person asked", () => {
    expect(whatHoldsUpdate({ ...calm, typedText: true, unsent: 2, canSend: true })).toBeNull();
  });
});
