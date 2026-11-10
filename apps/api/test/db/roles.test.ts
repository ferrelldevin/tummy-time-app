import { afterAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { assertRowAccessOnly, PrivilegeError } from "../../src/db/client.js";
import { appSettings, migratorSettings, rawPool } from "./helpers.js";

/**
 * Threat model #25: the app's database user must not be able to change tables. These run the
 * real statements as the app user and expect PostgreSQL to refuse each one.
 */

const INSUFFICIENT_PRIVILEGE = "42501";

async function sqlState(pool: pg.Pool, statement: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(statement);
    return "succeeded";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

describe("the app database user", () => {
  const app = rawPool(appSettings());
  const migrator = rawPool(migratorSettings());
  afterAll(async () => {
    await Promise.all([app.end(), migrator.end()]);
  });

  it.each([
    ["CREATE TABLE", "CREATE TABLE public.sneaky (id int)"],
    ["CREATE TABLE in another schema", "CREATE TABLE drizzle.sneaky (id int)"],
    ["CREATE TEMP TABLE", "CREATE TEMP TABLE sneaky (id int)"],
    ["CREATE SCHEMA", "CREATE SCHEMA sneaky"],
    ["CREATE INDEX", "CREATE INDEX sneaky ON tummy_logs (started_at)"],
    ["CREATE VIEW", "CREATE VIEW public.sneaky AS SELECT 1"],
    ["CREATE FUNCTION", "CREATE FUNCTION public.sneaky() RETURNS int LANGUAGE sql AS 'SELECT 1'"],
    ["ALTER TABLE ADD COLUMN", "ALTER TABLE tummy_logs ADD COLUMN notes text"],
    [
      "ALTER TABLE DROP CONSTRAINT",
      "ALTER TABLE tummy_logs DROP CONSTRAINT tummy_logs_duration_range",
    ],
    ["ALTER SEQUENCE", "ALTER SEQUENCE tummy_logs_rev_seq RESTART WITH 1"],
    ["DROP TABLE", "DROP TABLE tummy_logs"],
    ["DROP TYPE", "DROP TYPE audit_event_type"],
    ["TRUNCATE", "TRUNCATE tummy_logs"],
    ["take ownership of a table", "ALTER TABLE tummy_logs OWNER TO CURRENT_USER"],
    ["CREATE ROLE", "CREATE ROLE sneaky"],
    ["read the migration records", "SELECT * FROM drizzle.__drizzle_migrations"],
  ])("cannot %s", async (_label, statement) => {
    expect(await sqlState(app, statement)).toBe(INSUFFICIENT_PRIVILEGE);
  });

  it("can read and write rows (in a transaction that is rolled back)", async () => {
    expect(await sqlState(app, "SELECT count(*) FROM tummy_logs")).toBe("succeeded");
    expect(
      await sqlState(app, "UPDATE tummy_logs SET duration_seconds = duration_seconds WHERE false"),
    ).toBe("succeeded");
    expect(await sqlState(app, "DELETE FROM sessions WHERE false")).toBe("succeeded");
    expect(await sqlState(app, "SELECT nextval('tummy_logs_rev_seq')")).toBe("succeeded");
  });

  it("passes the API's start-up privilege check", async () => {
    await expect(assertRowAccessOnly(app)).resolves.toBeUndefined();
  });

  it("the start-up check refuses the migrator user", async () => {
    await expect(assertRowAccessOnly(migrator)).rejects.toThrow(PrivilegeError);
    await expect(assertRowAccessOnly(migrator)).rejects.toThrow(/owns the tables/);
  });
});
