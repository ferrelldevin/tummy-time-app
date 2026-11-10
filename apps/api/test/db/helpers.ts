import { randomUUID } from "node:crypto";
import pg from "pg";
import { loadAppDbSettings, loadMigratorDbSettings, type DbSettings } from "../../src/db/config.js";

/** A raw connection for tests that check the database itself. Tests may use SQL directly. */
export function rawPool(settings: DbSettings): pg.Pool {
  return new pg.Pool({ ...settings, max: 2 });
}

export const appSettings = () => loadAppDbSettings();
export const migratorSettings = () => loadMigratorDbSettings();

/** A made-up account, inserted directly. The hash values are placeholders, not real hashes. */
export async function makeAccount(pool: pg.Pool): Promise<string> {
  const id = randomUUID();
  const lookup = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  await pool.query(
    "INSERT INTO accounts (id, code_lookup, pin_hash) VALUES ($1, $2, '$argon2id$test-placeholder')",
    [id, lookup],
  );
  return id;
}

export async function removeAccounts(pool: pg.Pool, ids: string[]): Promise<void> {
  await pool.query("DELETE FROM audit_events WHERE account_id = ANY($1::uuid[])", [ids]);
  await pool.query("DELETE FROM accounts WHERE id = ANY($1::uuid[])", [ids]);
}
