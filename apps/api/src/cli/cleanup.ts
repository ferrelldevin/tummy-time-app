import { systemClock } from "../auth/clock.js";
import { openDb } from "../db/client.js";
import { loadAppDbSettings } from "../db/config.js";
import { removeEndedSessionsAndOldAuditEvents } from "../db/maintenance.js";
import { runCli } from "./run.js";

// pnpm db:cleanup. Runs as the app user, which already has DELETE on these tables, so it needs
// no more power. Prints only counts, never rows. Safe to run twice and while the API is running.
// It does not erase "deleted" tummy log entries yet: see src/db/maintenance.ts.
await runCli("db:cleanup", async () => {
  const handle = openDb(loadAppDbSettings(), { max: 1 });
  try {
    const counts = await removeEndedSessionsAndOldAuditEvents(handle.db, systemClock.now());
    console.log(
      `db:cleanup: removed ${String(counts.sessions)} ended sessions and ${String(counts.auditEvents)} old audit events.`,
    );
  } finally {
    await handle.close();
  }
});
