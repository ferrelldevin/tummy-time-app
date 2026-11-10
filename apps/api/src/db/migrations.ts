import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { openDb } from "./client.js";
import type { MigratorSettings } from "./config.js";

/** apps/api/drizzle: the checked-in SQL migration files. Same path from src/db and dist/db. */
export const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Any fixed number works; it only has to be the same for every copy of this program. */
const MIGRATION_LOCK_ID = 4_172_031;

/**
 * Brings the database from whatever version it is at to the newest migration, as the migrator
 * user, then gives the app user row access (and nothing more) to every table.
 *
 * Drizzle records which files ran in drizzle.__drizzle_migrations, so running this twice is safe.
 */
export async function runMigrations(settings: MigratorSettings): Promise<void> {
  // One connection, so the lock and the migration share a session.
  const handle = openDb(settings, { max: 1 });
  try {
    await handle.db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`);
    try {
      await migrate(handle.db, { migrationsFolder, migrationsSchema: "drizzle" });
      const app = sql.identifier(settings.appUser);
      await handle.db.execute(sql`GRANT USAGE ON SCHEMA public TO ${app}`);
      await handle.db.execute(
        sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${app}`,
      );
      // USAGE lets the app call nextval() on the rev counter. It cannot alter the sequence.
      await handle.db.execute(sql`GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO ${app}`);
    } finally {
      await handle.db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
    }
  } finally {
    await handle.close();
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/**
 * db:reset erases every table. It runs only when NODE_ENV says development or test AND the
 * database is on this machine. Returns why it refuses, or null when it may run.
 */
export function resetRefusal(env: {
  NODE_ENV?: string | undefined;
  DB_HOST?: string;
}): string | null {
  const nodeEnv = env.NODE_ENV ?? "";
  if (nodeEnv !== "development" && nodeEnv !== "test") {
    return `NODE_ENV is "${nodeEnv}". db:reset only runs when NODE_ENV is development or test.`;
  }
  const host = env.DB_HOST ?? "127.0.0.1";
  const isSocket = host.startsWith("/");
  if (!isSocket && !LOCAL_HOSTS.has(host.toLowerCase())) {
    return `DB_HOST is "${host}". db:reset only runs against a database on this machine.`;
  }
  return null;
}

/** Drops everything the migrator owns and recreates an empty public schema. */
export async function dropEverything(settings: MigratorSettings): Promise<void> {
  const handle = openDb(settings, { max: 1 });
  try {
    await handle.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await handle.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await handle.db.execute(sql`CREATE SCHEMA public AUTHORIZATION CURRENT_USER`);
    await handle.db.execute(sql`REVOKE ALL ON SCHEMA public FROM PUBLIC`);
  } finally {
    await handle.close();
  }
}
