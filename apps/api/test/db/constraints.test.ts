import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { appSettings, makeAccount, rawPool, removeAccounts } from "./helpers.js";

/** The database refuses bad rows even if the API's own checks were skipped. */
describe("table constraints", () => {
  const pool = rawPool(appSettings());
  const made: string[] = [];
  afterAll(async () => {
    await removeAccounts(pool, made);
    await pool.end();
  });

  async function state(statement: string, params: unknown[]): Promise<string> {
    try {
      await pool.query(statement, params);
      return "ok";
    } catch (error) {
      return (error as { code?: string }).code ?? "unknown";
    }
  }
  const CHECK = "23514";
  const FOREIGN_KEY = "23503";
  const NOT_NULL = "23502";
  const INVALID_ENUM = "22P02";

  it("a raw PIN or a raw family code cannot be stored", async () => {
    const insert = "INSERT INTO accounts (code_lookup, pin_hash) VALUES ($1, $2)";
    const lookup = "f".repeat(64);
    expect(await state(insert, [lookup, "123456"])).toBe(CHECK);
    expect(await state(insert, ["ABCD-EFGH-JKMN", "$argon2id$x"])).toBe(CHECK);
  });

  it("tummy time length stays between 1 second and 2 hours", async () => {
    const account = await makeAccount(pool);
    made.push(account);
    const insert =
      "INSERT INTO tummy_logs (id, account_id, started_at, duration_seconds) VALUES ($1, $2, now(), $3)";
    expect(await state(insert, [randomUUID(), account, 0])).toBe(CHECK);
    expect(await state(insert, [randomUUID(), account, 7201])).toBe(CHECK);
    expect(await state(insert, [randomUUID(), account, 7200])).toBe("ok");
    expect(await state(insert, [randomUUID(), account, null])).toBe(NOT_NULL);
  });

  it("a log or session must belong to an account that exists", async () => {
    expect(
      await state(
        "INSERT INTO tummy_logs (id, account_id, started_at, duration_seconds) VALUES ($1, $2, now(), 60)",
        [randomUUID(), randomUUID()],
      ),
    ).toBe(FOREIGN_KEY);
  });

  it("audit events accept only the listed types", async () => {
    expect(await state("INSERT INTO audit_events (type) VALUES ($1)", ["password_reset"])).toBe(
      INVALID_ENUM,
    );
  });

  it("deleting an account removes its logs and sessions and unlinks its audit events", async () => {
    const account = await makeAccount(pool);
    await pool.query(
      "INSERT INTO tummy_logs (id, account_id, started_at, duration_seconds) VALUES ($1, $2, now(), 60)",
      [randomUUID(), account],
    );
    await pool.query(
      "INSERT INTO sessions (id_hash, account_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
      ["c".repeat(64), account],
    );
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO audit_events (type, account_id) VALUES ('account_deleted', $1) RETURNING id",
      [account],
    );
    await pool.query("DELETE FROM accounts WHERE id = $1", [account]);

    const count = async (sql: string) =>
      Number((await pool.query<{ n: string }>(sql, [account])).rows[0]?.n);
    expect(await count("SELECT count(*) AS n FROM tummy_logs WHERE account_id = $1")).toBe(0);
    expect(await count("SELECT count(*) AS n FROM sessions WHERE account_id = $1")).toBe(0);
    const event = await pool.query("SELECT account_id FROM audit_events WHERE id = $1", [
      rows[0]?.id,
    ]);
    expect(event.rows[0]).toEqual({ account_id: null });
    await pool.query("DELETE FROM audit_events WHERE id = $1", [rows[0]?.id]);
  });
});
