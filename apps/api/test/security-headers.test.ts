import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("security headers", () => {
  const app = buildApp();
  afterAll(async () => {
    await app.close();
  });

  it.each([
    ["a normal answer", "/api/health", 200],
    ["an error answer", "/api/nothing-here", 404],
    ["a refused request", "/api/health?x=1", 400],
  ])("are on %s", async (_label, url, status) => {
    const res = await app.inject({ method: "GET", url });
    expect(res.statusCode).toBe(status);
    const csp = String(res.headers["content-security-policy"]);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(res.headers["strict-transport-security"]).toMatch(/max-age=\d{8,}; includeSubDomains/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
