import { defineConfig } from "drizzle-kit";

// Used only by `pnpm --filter @tummy/api db:generate`, which turns src/db/schema.ts into a new
// SQL migration file. It never connects to a database, so it needs no settings or passwords.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
