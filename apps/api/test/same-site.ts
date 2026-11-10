/**
 * What our own page sends with every request that changes something (src/http/security.ts).
 * Tests build the app with appOrigin: TEST_ORIGIN and send these headers.
 */
export const TEST_ORIGIN = "http://127.0.0.1:5173";
export const SAME_SITE = { origin: TEST_ORIGIN, "x-tummy-request": "1" } as const;
