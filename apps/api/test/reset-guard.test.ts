import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resetRefusal } from "../src/db/migrations.js";

describe("db:reset refuses to run anywhere but a local development or test database", () => {
  it.each([
    [{ NODE_ENV: "development", DB_HOST: "127.0.0.1" }],
    [{ NODE_ENV: "test", DB_HOST: "localhost" }],
    [{ NODE_ENV: "development", DB_HOST: "::1" }],
    [{ NODE_ENV: "development", DB_HOST: "/var/run/postgresql" }],
    [{ NODE_ENV: "development" }],
  ])("runs for %o", (env) => {
    expect(resetRefusal(env)).toBeNull();
  });

  it.each([
    [{ NODE_ENV: "production", DB_HOST: "127.0.0.1" }, /NODE_ENV is "production"/],
    [{ DB_HOST: "127.0.0.1" }, /NODE_ENV is ""/],
    [{ NODE_ENV: "staging", DB_HOST: "127.0.0.1" }, /NODE_ENV/],
    [{ NODE_ENV: "development", DB_HOST: "db.example.org" }, /DB_HOST is "db.example.org"/],
    [{ NODE_ENV: "development", DB_HOST: "10.0.0.5" }, /DB_HOST/],
    [{ NODE_ENV: "test", DB_HOST: "db" }, /DB_HOST/],
  ])("refuses %o", (env, reason) => {
    expect(resetRefusal(env)).toMatch(reason);
  });

  it("the real command refuses, exits 1 and opens no connection", () => {
    const apiDir = fileURLToPath(new URL("..", import.meta.url));
    const result = spawnSync("pnpm", ["exec", "tsx", "src/cli/reset.ts"], {
      cwd: apiDir,
      encoding: "utf8",
      // Port 1 has no database: had the command tried to connect, it would fail differently.
      env: { ...process.env, NODE_ENV: "production", DB_HOST: "127.0.0.1", DB_PORT: "1" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/db:reset: refused\. NODE_ENV is "production"/);
    expect(result.stderr).toMatch(/Nothing was changed/);
  });
});
