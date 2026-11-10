import { buildApp } from "./app.js";
import { assertRowAccessOnly, openDb, PrivilegeError } from "./db/client.js";
import { loadAppDbSettings } from "./db/config.js";
import { EnvError, loadEnv } from "./env.js";

try {
  const env = loadEnv();
  const db = openDb(loadAppDbSettings());
  try {
    // Fails fast if the database is down, or if this is not the low-privilege app user.
    await assertRowAccessOnly(db.pool);
  } catch (error) {
    await db.close();
    throw error;
  }
  const app = buildApp({ ...env, db });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().then(() => process.exit(0));
    });
  }
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
} catch (error) {
  if (error instanceof EnvError || error instanceof PrivilegeError) {
    console.error(error.message);
  } else {
    const code =
      typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    // The full error is not printed: a database error can quote connection details or values.
    console.error(
      `The API failed to start${code ? ` (${code})` : ""}. Is the database running? See docs/runbook.md.`,
    );
  }
  process.exit(1);
}
