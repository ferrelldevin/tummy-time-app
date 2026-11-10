import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "../src/index.js";

describe("healthResponseSchema", () => {
  it("accepts { ok: true }", () => {
    expect(healthResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });

  it("rejects a missing or false ok", () => {
    expect(healthResponseSchema.safeParse({}).success).toBe(false);
    expect(healthResponseSchema.safeParse({ ok: false }).success).toBe(false);
  });
});
