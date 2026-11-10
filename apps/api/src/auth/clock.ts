/**
 * Where sign-in code gets the time. Tests pass a clock they can move forward, so lockout release
 * and session expiry are tested without waiting. Every time the sign-in code compares or stores
 * comes from here, never from the database's own clock.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
