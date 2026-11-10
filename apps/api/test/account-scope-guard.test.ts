import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * THE "ALWAYS FILTER BY ACCOUNT" GUARD (threat model #8).
 *
 * Every query on an account's rows must go through src/db/account-scope.ts. This test reads
 * every source file under src/ and fails if any other file
 *   - imports one of the tables from the schema module (or the whole module), or
 *   - names one of the tables in SQL text (a string or template literal).
 * The allowlist below is the only way around it, and each entry says why.
 */

const srcDir = fileURLToPath(new URL("../src", import.meta.url));

/** Table variable in schema.ts -> table name in SQL. */
export const GUARDED_TABLES: Record<string, string> = {
  tummyLogs: "tummy_logs",
  sessions: "sessions",
  auditEvents: "audit_events",
  accounts: "accounts",
};

/** File (relative to src/) -> tables it may use directly, and why. Changing this is reviewed. */
export const ALLOWLIST = new Map<string, { tables: string[]; why: string }>(
  Object.entries({
    "db/schema.ts": { tables: Object.keys(GUARDED_TABLES), why: "defines the tables" },
    "db/account-scope.ts": {
      // accounts: only to delete the signed-in account for good (deleteAccount), by its own ID.
      tables: ["tummyLogs", "sessions", "auditEvents", "accounts"],
      why: "the one door: adds the account filter to every query",
    },
    "db/seed.ts": { tables: ["accounts"], why: "creates the made-up sample accounts" },
    // Block 4 (ADR 0008): the queries that run before anyone is signed in, so no session can
    // vouch for an account ID yet. No tummyLogs: nothing before sign-in may read a log.
    "auth/credential-store.ts": {
      tables: ["accounts", "sessions", "auditEvents"],
      why:
        "before sign-in: find an account by its code's keyed hash, count and clear PIN attempts, " +
        "create an account, find, refresh or end a session by its token's hash, and record a " +
        "failed sign-in that matches no account",
    },
  }),
);

/** A guarded table named right after an SQL keyword. Quotes and "public." are removed first. */
const SQL_AFTER_KEYWORD =
  /\b(?:from|join|into|update|table|truncate|on)\s+(tummy_logs|sessions|audit_events|accounts)\b/i;
/** Two table names that can only mean a table, wherever they appear. */
const SQL_ONLY_TABLE = /\b(tummy_logs|audit_events)\b/i;

function sqlTableName(text: string): string | undefined {
  const plain = text.replaceAll('"', "").replace(/\bpublic\s*\./gi, "");
  return SQL_AFTER_KEYWORD.exec(plain)?.[1] ?? SQL_ONLY_TABLE.exec(plain)?.[1];
}

function isSchemaModule(specifier: string): boolean {
  return /(^|\/)schema(\.js|\.ts)?$/.test(specifier);
}

/** Every way `file` reaches a guarded table, as plain descriptions. */
export function findTableUses(fileName: string, text: string): { table: string; how: string }[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const uses: { table: string; how: string }[] = [];
  const line = (node: ts.Node) =>
    String(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);

  const visit = (node: ts.Node): void => {
    // import { tummyLogs } from "./schema.js"  /  import * as s from "./schema.js"
    // export { tummyLogs } from "./schema.js"  /  export * from "./schema.js"
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      isSchemaModule(node.moduleSpecifier.text)
    ) {
      const names: string[] = [];
      let whole = false;
      if (ts.isImportDeclaration(node)) {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) whole = true;
        if (bindings && ts.isNamedImports(bindings)) {
          names.push(...bindings.elements.map((e) => (e.propertyName ?? e.name).text));
        }
        if (node.importClause?.name) whole = true;
      } else if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) {
        whole = true;
      } else {
        names.push(...node.exportClause.elements.map((e) => (e.propertyName ?? e.name).text));
      }
      const tables = whole ? Object.keys(GUARDED_TABLES) : names.filter((n) => n in GUARDED_TABLES);
      for (const table of tables) {
        uses.push({ table, how: `line ${line(node)}: imports ${table} from the schema` });
      }
    }
    // await import("./schema.js")
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      isSchemaModule(node.arguments[0].text)
    ) {
      for (const table of Object.keys(GUARDED_TABLES)) {
        uses.push({ table, how: `line ${line(node)}: imports the schema at run time` });
      }
    }
    // SQL text: "SELECT * FROM tummy_logs", sql`... audit_events ...`
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const name = sqlTableName(node.text);
      if (name) {
        const table =
          Object.entries(GUARDED_TABLES).find(
            ([, sqlName]) => sqlName === name.toLowerCase(),
          )?.[0] ?? name;
        uses.push({ table, how: `line ${line(node)}: names ${name} in SQL text` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return uses;
}

function sourceFiles(dir: string): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- walks this repo's own src/ folder, a path fixed in this file; no outside input reaches it.
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|mts|cts|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

/** Uses that the allowlist does not cover, across all of src/. */
export function violations(files: { path: string; text: string }[]): string[] {
  return files.flatMap(({ path, text }) => {
    const allowed = new Set(ALLOWLIST.get(path)?.tables ?? []);
    return findTableUses(path, text)
      .filter((use) => !allowed.has(use.table))
      .map((use) => `src/${path} ${use.how}. Go through forAccount() in src/db/account-scope.ts.`);
  });
}

describe("every query on account rows goes through src/db/account-scope.ts", () => {
  it("no file under src/ reaches the tables any other way", () => {
    const files = sourceFiles(srcDir).map((full) => ({
      path: relative(srcDir, full).split("\\").join("/"),
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- a file found by the walk above, inside this repo's src/; no outside input reaches it.
      text: readFileSync(full, "utf8"),
    }));
    expect(files.length).toBeGreaterThan(5);
    expect(violations(files)).toEqual([]);
  });

  describe("the guard itself catches each way around it", () => {
    const bad = (text: string) => violations([{ path: "routes/logs.ts", text }]);

    it.each([
      ['import { tummyLogs } from "../db/schema.js";'],
      ['import { tummyLogs as t } from "../db/schema.js";'],
      ['import * as schema from "../db/schema.js";'],
      ['export * from "../db/schema.js";'],
      ['const s = await import("../db/schema.js");'],
      ['await pool.query("SELECT * FROM tummy_logs WHERE id = $1", [id]);'],
      ["await db.execute(sql`DELETE FROM sessions WHERE id_hash = ${h}`);"],
      ['await pool.query(`UPDATE "public"."accounts" SET failed_attempts = 0`);'],
      ['const q = "insert into audit_events (type) values ($1)";'],
    ])("%s", (text) => {
      expect(bad(text).length).toBeGreaterThan(0);
    });

    it("leaves ordinary code alone", () => {
      expect(bad('import { forAccount } from "../db/account-scope.js";')).toEqual([]);
      expect(bad('const message = "Sign out of all sessions";')).toEqual([]);
    });

    it("an allowlisted file may use only its own tables", () => {
      expect(
        violations([{ path: "db/seed.ts", text: 'import { tummyLogs } from "./schema.js";' }]),
      ).toHaveLength(1);
    });
  });
});
