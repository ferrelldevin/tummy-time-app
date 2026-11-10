import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { DbSettings } from "./config.js";

export type Db = NodePgDatabase;
/** The pool's database handle, or a transaction opened on it. Both run the same queries. */
export type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface DbHandle {
  db: Db;
  pool: pg.Pool;
  close: () => Promise<void>;
}

/**
 * Opens a connection pool. Settings are passed as fields, never as a connection URL, so a
 * password cannot end up in an error message that prints the URL.
 */
export function openDb(settings: DbSettings, options: { max?: number } = {}): DbHandle {
  const pool = new pg.Pool({
    host: settings.host,
    port: settings.port,
    database: settings.database,
    user: settings.user,
    password: settings.password,
    max: options.max ?? 10,
    application_name: "tummy-time",
  });
  // An idle connection that drops (database restart) must not crash the API.
  pool.on("error", () => undefined);
  return {
    db: drizzle(pool),
    pool,
    close: () => pool.end(),
  };
}

export class PrivilegeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivilegeError";
  }
}

/**
 * Refuses to go on if this connection can change table structure. The API calls it at start-up
 * so it can never run as the migrator user or a superuser by mistake (threat model #25).
 */
export async function assertRowAccessOnly(pool: pg.Pool): Promise<void> {
  const { rows } = await pool.query<{
    rolsuper: boolean;
    rolcreatedb: boolean;
    rolcreaterole: boolean;
    can_create_in_public: boolean;
    can_create_in_db: boolean;
    can_temp: boolean;
    owns_tables: boolean;
  }>(`
    SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole,
           has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public,
           has_database_privilege(current_user, current_database(), 'CREATE') AS can_create_in_db,
           has_database_privilege(current_user, current_database(), 'TEMPORARY') AS can_temp,
           EXISTS (SELECT 1 FROM pg_tables t WHERE t.schemaname = 'public'
                   AND t.tableowner = current_user) AS owns_tables
    FROM pg_roles r WHERE r.rolname = current_user`);
  const row = rows[0];
  if (row === undefined) {
    throw new PrivilegeError("Could not read the database user's privileges.");
  }
  const problems = [
    row.rolsuper && "is a superuser",
    row.rolcreatedb && "can create databases",
    row.rolcreaterole && "can create users",
    row.can_create_in_public && "can create tables",
    row.can_create_in_db && "can create schemas",
    row.can_temp && "can create temporary tables",
    row.owns_tables && "owns the tables",
  ].filter((p): p is string => typeof p === "string");
  if (problems.length > 0) {
    throw new PrivilegeError(
      `The API's database user has too much power: it ${problems.join(", ")}. ` +
        "Connect the API as the app user (DB_APP_USER), not the migrator. See docs/runbook.md.",
    );
  }
}
