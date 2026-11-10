import { afterEach, describe, expect, it } from "vitest";
import { healthResponseSchema } from "@tummy/shared";
import { buildApp } from "../src/app.js";

describe("GET /api/health", () => {
  const app = buildApp();
  afterEach(async () => {
    await app.close();
  });

  it("returns { ok: true } that matches the shared schema", async () => {
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({ ok: true });
  });
});
