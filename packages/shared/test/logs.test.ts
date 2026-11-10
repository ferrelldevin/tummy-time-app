import { describe, expect, it } from "vitest";
import {
  LOG_MAX_AGE_MS,
  LOG_MAX_FUTURE_MS,
  isAllowedStartTime,
  logIdSchema,
  logsQuerySchema,
  putLogBodySchema,
} from "../src/index.js";

const ID = "3f2b8c1e-7a4d-4e5f-9b6a-0c1d2e3f4a5b";

describe("logIdSchema", () => {
  it("takes a lowercase dashed UUID", () => {
    expect(logIdSchema.safeParse(ID).success).toBe(true);
  });

  it.each([
    ["upper case", ID.toUpperCase()],
    ["no dashes", ID.replaceAll("-", "")],
    ["braces", `{${ID}}`],
    ["too short", ID.slice(0, -1)],
    ["not hex", ID.replace("3f", "zz")],
    ["spaces", ` ${ID}`],
  ])("refuses %s", (_name, value) => {
    expect(logIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("putLogBodySchema", () => {
  const ok = { startedAt: "2026-11-10T09:00:00Z", durationSeconds: 300 };

  it("takes a time with Z or an offset, and whole seconds from 1 to 7200", () => {
    expect(putLogBodySchema.safeParse(ok).success).toBe(true);
    expect(
      putLogBodySchema.safeParse({ ...ok, startedAt: "2026-11-10T09:00:00.250-05:00" }).success,
    ).toBe(true);
    expect(putLogBodySchema.safeParse({ ...ok, durationSeconds: 1 }).success).toBe(true);
    expect(putLogBodySchema.safeParse({ ...ok, durationSeconds: 7200 }).success).toBe(true);
  });

  it.each([
    ["0 seconds", { ...ok, durationSeconds: 0 }],
    ["7201 seconds", { ...ok, durationSeconds: 7201 }],
    ["a fraction", { ...ok, durationSeconds: 1.5 }],
    ["a string number", { ...ok, durationSeconds: "300" }],
    ["a time with no offset", { ...ok, startedAt: "2026-11-10T09:00:00" }],
    ["a date that does not exist", { ...ok, startedAt: "2026-02-30T09:00:00Z" }],
    ["an unknown field", { ...ok, note: "hello" }],
    ["a missing field", { startedAt: ok.startedAt }],
  ])("refuses %s", (_name, value) => {
    expect(putLogBodySchema.safeParse(value).success).toBe(false);
  });
});

describe("logsQuerySchema", () => {
  it("reads since as a whole number, and allows it to be left out", () => {
    expect(logsQuerySchema.parse({ since: "0" })).toEqual({ since: 0 });
    expect(logsQuerySchema.parse({ since: "42" })).toEqual({ since: 42 });
    expect(logsQuerySchema.parse({})).toEqual({});
    expect(logsQuerySchema.parse({ since: String(Number.MAX_SAFE_INTEGER) })).toEqual({
      since: Number.MAX_SAFE_INTEGER,
    });
  });

  it.each(["-1", "1.5", "01", "1e3", "abc", "", String(Number.MAX_SAFE_INTEGER + 1)])(
    "refuses since=%s",
    (since) => {
      expect(logsQuerySchema.safeParse({ since }).success).toBe(false);
    },
  );
});

describe("isAllowedStartTime", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("allows up to 5 minutes ahead (phone clocks drift) and not one millisecond more", () => {
    expect(isAllowedStartTime(new Date(now.getTime() + LOG_MAX_FUTURE_MS), now)).toBe(true);
    expect(isAllowedStartTime(new Date(now.getTime() + LOG_MAX_FUTURE_MS + 1), now)).toBe(false);
  });

  it("allows back to 365 days ago and not one millisecond more", () => {
    expect(isAllowedStartTime(new Date(now.getTime() - LOG_MAX_AGE_MS), now)).toBe(true);
    expect(isAllowedStartTime(new Date(now.getTime() - LOG_MAX_AGE_MS - 1), now)).toBe(false);
  });

  it("refuses a date that is not a date", () => {
    expect(isAllowedStartTime(new Date("nonsense"), now)).toBe(false);
  });
});
