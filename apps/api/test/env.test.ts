import { describe, expect, it } from "vitest";
import { EnvError, loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("accepts a complete environment and fills defaults", () => {
    const env = loadEnv({ API_PORT: "3001" });
    expect(env).toEqual({ API_PORT: 3001, API_HOST: "127.0.0.1", LOG_LEVEL: "info" });
  });

  it("refuses to start when a required variable is missing, naming it", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
    expect(() => loadEnv({})).toThrow(/API_PORT: missing/);
    expect(() => loadEnv({})).toThrow(/\.env\.example/);
  });

  it("refuses a value that is not valid", () => {
    expect(() => loadEnv({ API_PORT: "not-a-port" })).toThrow(/API_PORT/);
    expect(() => loadEnv({ API_PORT: "3001", LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
