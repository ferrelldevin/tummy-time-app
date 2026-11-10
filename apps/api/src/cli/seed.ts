import { openDb } from "../db/client.js";
import { loadAppDbSettings } from "../db/config.js";
import { seed } from "../db/seed.js";
import { runCli } from "./run.js";

// pnpm db:seed. Runs as the app user: seeding only adds rows, so it needs no more power.
await runCli("db:seed", async () => {
  const handle = openDb(loadAppDbSettings());
  try {
    const result = await seed(handle.db);
    console.log(
      `db:seed: added ${String(result.accounts)} sample accounts and ${String(result.logs)} sample tummy times (made-up data).`,
    );
  } finally {
    await handle.close();
  }
});
