import { openDb } from "../db/client.js";
import { loadAppDbSettings, loadMigratorDbSettings } from "../db/config.js";
import { dropEverything, resetRefusal, runMigrations } from "../db/migrations.js";
import { seed } from "../db/seed.js";
import { CliRefusal, runCli } from "./run.js";

// pnpm db:reset. Erases every table, migrates from empty and seeds. Development and test only.
await runCli("db:reset", async () => {
  // Refuse before reading any password or opening any connection.
  const refusal = resetRefusal(process.env);
  if (refusal !== null) {
    throw new CliRefusal(`refused. ${refusal} Nothing was changed.`);
  }
  const migrator = loadMigratorDbSettings();
  const app = loadAppDbSettings();
  await dropEverything(migrator);
  await runMigrations(migrator);
  const handle = openDb(app);
  try {
    const result = await seed(handle.db);
    console.log(
      `db:reset: database "${migrator.database}" erased, migrated and seeded with ${String(result.accounts)} sample accounts.`,
    );
  } finally {
    await handle.close();
  }
});
