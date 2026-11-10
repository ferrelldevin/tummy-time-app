import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// The database tests read their settings from the repo's .env, like `pnpm dev` does. Values
// already in the environment win (CI sets them in the workflow and has no .env file).
const envFile = resolve(import.meta.dirname, "../../.env");
if (existsSync(envFile)) {
  const fromFile = Object.entries(parseEnv(readFileSync(envFile, "utf8"))).filter(
    ([key]) => key !== "NODE_ENV" && !Object.hasOwn(process.env, key),
  );
  Object.assign(process.env, Object.fromEntries(fromFile));
}

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Migrates the database before any test runs, and fails the whole run, loudly, when there
    // is no database. Database tests never skip themselves.
    globalSetup: ["test/global-setup.ts"],
    // Database tests share one database; one file at a time keeps them from tripping over
    // each other.
    fileParallelism: false,
  },
});
