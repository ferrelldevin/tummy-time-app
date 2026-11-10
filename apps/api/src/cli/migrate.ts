import { loadMigratorDbSettings } from "../db/config.js";
import { runMigrations } from "../db/migrations.js";
import { runCli } from "./run.js";

// pnpm db:migrate. Runs as the migrator user.
await runCli("db:migrate", async () => {
  const settings = loadMigratorDbSettings();
  await runMigrations(settings);
  console.log(`db:migrate: database "${settings.database}" is up to date.`);
});
