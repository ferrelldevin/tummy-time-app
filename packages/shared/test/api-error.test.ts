import { describe, expect, it } from "vitest";
import { apiErrorSchema } from "../src/index.js";

describe("apiErrorSchema", () => {
  it("accepts the one error shape", () => {
    const body = { error: { code: "not_found", message: "That address does not exist." } };
    expect(apiErrorSchema.parse(body)).toEqual(body);
  });

  it("rejects unknown codes, extra fields and a missing message", () => {
    expect(apiErrorSchema.safeParse({ error: { code: "teapot", message: "x" } }).success).toBe(
      false,
    );
    expect(
      apiErrorSchema.safeParse({ error: { code: "not_found", message: "x", stack: "at y" } })
        .success,
    ).toBe(false);
    expect(apiErrorSchema.safeParse({ error: { code: "not_found" } }).success).toBe(false);
  });
});
