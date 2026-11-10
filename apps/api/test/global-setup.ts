import { loadMigratorDbSettings } from "../src/db/config.js";
import { runMigrations } from "../src/db/migrations.js";

export default async function globalSetup(): Promise<void> {
  let settings;
  try {
    settings = loadMigratorDbSettings();
  } catch (error) {
    throw new Error(
      "The API tests need a PostgreSQL database and none is configured. They do not skip.\n" +
        `${error instanceof Error ? error.message : String(error)}\n` +
        "Start one and fill in the DB_ settings in .env: see docs/runbook.md.",
    );
  }
  try {
    await runMigrations(settings);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    throw new Error(
      `The API tests could not reach or migrate the database "${settings.database}" on ` +
        `${settings.host}:${String(settings.port)}${code ? ` (${code})` : ""}. They do not skip. ` +
        "Is it running, and were the users made with infra/db/init-roles.sh? See docs/runbook.md.",
    );
  }
}
