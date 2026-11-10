import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { migratorSettings, rawPool } from "./helpers.js";

/**
 * THE DATA-MAP GATE. docs/data-map.md lists every field the app may store. This test reads the
 * live database (after migrations ran in test/global-setup.ts) and compares, both ways:
 * - a table or column in the database that the map does not list fails the build;
 * - a table or field in the map that the database does not have fails the build.
 * It also checks the audit event types the database accepts against the map's list.
 */

const dataMapPath = fileURLToPath(new URL("../../../../docs/data-map.md", import.meta.url));

/** Bookkeeping that is not app data: Drizzle's record of which migrations ran. */
const BOOKKEEPING = new Set(["drizzle.__drizzle_migrations"]);

export type Tables = Map<string, Set<string>>;

/** Reads the "On the server (database)" section: each ### heading is a table, each row a field. */
export function parseDataMap(markdown: string): { tables: Tables; auditTypes: string[] } {
  const start = markdown.indexOf("## On the server (database)");
  if (start === -1) throw new Error('data-map.md has no "## On the server (database)" section');
  const rest = markdown.slice(start + 3);
  const end = rest.search(/^## /m);
  const section = end === -1 ? rest : rest.slice(0, end);

  const tables: Tables = new Map();
  let auditTypes: string[] = [];
  let current: Set<string> | undefined;
  let currentName = "";
  for (const line of section.split("\n")) {
    const heading = /^###\s+(\S+)\s*$/.exec(line);
    if (heading?.[1]) {
      currentName = heading[1];
      current = new Set();
      tables.set(currentName, current);
      continue;
    }
    const row = /^\|\s*([a-z_]+)\s*\|(.*)$/.exec(line);
    if (current && row?.[1] && row[1] !== "field") {
      current.add(row[1]);
      const types = /One of:\s*([a-z_,\s]+)\|/.exec(row[2] ?? "");
      if (currentName === "audit_events" && row[1] === "type" && types?.[1]) {
        auditTypes = types[1].split(",").map((t) => t.trim());
      }
    }
  }
  return { tables, auditTypes };
}

/** Every difference between the database and the map, in plain words. Empty means they match. */
export function compareToMap(live: Tables, map: Tables): string[] {
  const problems: string[] = [];
  for (const [table, columns] of live) {
    const allowed = map.get(table);
    if (!allowed) {
      problems.push(`table "${table}" is in the database but not in docs/data-map.md`);
      continue;
    }
    for (const column of columns) {
      if (!allowed.has(column)) {
        problems.push(`column "${table}.${column}" is in the database but not in docs/data-map.md`);
      }
    }
  }
  for (const [table, fields] of map) {
    const columns = live.get(table);
    if (!columns) {
      problems.push(`table "${table}" is in docs/data-map.md but not in the database`);
      continue;
    }
    for (const field of fields) {
      if (!columns.has(field)) {
        problems.push(`field "${table}.${field}" is in docs/data-map.md but not in the database`);
      }
    }
  }
  return problems;
}

const t = (entries: Record<string, string[]>): Tables =>
  new Map(Object.entries(entries).map(([k, v]) => [k, new Set(v)]));

describe("the comparison itself (it must bite both ways)", () => {
  const map = t({ tummy_logs: ["id", "rev"] });

  it("passes when they match", () => {
    expect(compareToMap(t({ tummy_logs: ["id", "rev"] }), map)).toEqual([]);
  });

  it("fails on a database column the map does not list", () => {
    expect(compareToMap(t({ tummy_logs: ["id", "rev", "notes"] }), map)).toEqual([
      'column "tummy_logs.notes" is in the database but not in docs/data-map.md',
    ]);
  });

  it("fails on a database table the map does not list", () => {
    expect(compareToMap(t({ tummy_logs: ["id", "rev"], babies: ["name"] }), map)).toEqual([
      'table "babies" is in the database but not in docs/data-map.md',
    ]);
  });

  it("fails on a map field the database does not have", () => {
    expect(compareToMap(t({ tummy_logs: ["id"] }), map)).toEqual([
      'field "tummy_logs.rev" is in docs/data-map.md but not in the database',
    ]);
  });
});

describe("the live database matches docs/data-map.md", () => {
  const pool = rawPool(migratorSettings());
  afterAll(async () => {
    await pool.end();
  });

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- docs/data-map.md, a path fixed in this file; no outside input reaches it.
  const { tables: map, auditTypes } = parseDataMap(readFileSync(dataMapPath, "utf8"));

  it("the map still names the four skeleton tables", () => {
    expect([...map.keys()].sort()).toEqual(["accounts", "audit_events", "sessions", "tummy_logs"]);
  });

  it("every table and column, in both directions", async () => {
    const { rows } = await pool.query<{ schema: string; table: string; column: string }>(`
      SELECT c.table_schema AS schema, c.table_name AS table, c.column_name AS column
      FROM information_schema.columns c
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND c.table_schema NOT LIKE 'pg_toast%' AND c.table_schema NOT LIKE 'pg_temp%'`);

    const live: Tables = new Map();
    const elsewhere: string[] = [];
    for (const row of rows) {
      if (row.schema !== "public") {
        const name = `${row.schema}.${row.table}`;
        if (!BOOKKEEPING.has(name)) elsewhere.push(`${name}.${row.column}`);
        continue;
      }
      const columns = live.get(row.table) ?? new Set<string>();
      columns.add(row.column);
      live.set(row.table, columns);
    }

    expect(elsewhere, "tables outside the public schema that the map does not cover").toEqual([]);
    expect(compareToMap(live, map)).toEqual([]);
  });

  it("audit_events.type accepts exactly the types the map lists", async () => {
    const { rows } = await pool.query<{ label: string }>(`
      SELECT e.enumlabel AS label
      FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'audit_event_type' ORDER BY e.enumsortorder`);
    expect(auditTypes.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.label)).toEqual(auditTypes);
  });
});
