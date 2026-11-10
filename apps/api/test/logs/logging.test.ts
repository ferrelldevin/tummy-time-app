import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authTestApp, signUp, type AuthTestApp, type SignedUp } from "../auth/helpers.js";
import { deleteLog, getLogs, newId, putLog } from "./helpers.js";

/**
 * The log routes follow Block 3's logging rules (docs/data-map.md, "In logs"): method, path,
 * status, duration and a request ID. An entry's start time and length never reach a log line,
 * not on success, not on a refusal.
 */

const lines: string[] = [];
let t: AuthTestApp;
let acct: SignedUp;

beforeAll(async () => {
  t = await authTestApp({
    app: { LOG_LEVEL: "info", logStream: { write: (line: string) => lines.push(line) } },
  });
  acct = await signUp(t);
});
afterAll(async () => {
  await t.close();
});

describe("log routes write no entry contents to the logs", () => {
  it("PUT, a refused PUT, DELETE and GET log only method, path and status", async () => {
    // Made-up, easy-to-spot values.
    const startedAt = new Date(t.clock.now().getTime() - 17 * 60_000 - 777).toISOString();
    const id = newId();
    expect((await putLog(t, acct.token, id, { startedAt, durationSeconds: 4321 })).statusCode).toBe(
      200,
    );
    expect(
      (await putLog(t, acct.token, newId(), { startedAt, durationSeconds: 3333 })).statusCode,
    ).toBe(200);
    expect(
      (await putLog(t, acct.token, newId(), { startedAt, durationSeconds: 98765 })).statusCode,
    ).toBe(400);
    expect((await deleteLog(t, acct.token, id)).statusCode).toBe(200);
    expect((await getLogs(t, acct.token, 0)).statusCode).toBe(200);

    const all = lines.join("\n");
    expect(all).toContain("/api/logs");
    for (const value of [startedAt, startedAt.slice(0, 19), acct.token]) {
      expect(all).not.toContain(value);
    }
    // The lengths are plain numbers, which could turn up by chance inside a random request ID,
    // so look for them as logged values and as field names instead.
    expect(all).not.toMatch(/:\s*(4321|3333|98765)\b/);
    expect(all).not.toMatch(/durationSeconds|duration_seconds|startedAt|started_at/);
  });
});
