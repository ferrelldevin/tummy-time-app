import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// PLACEHOLDER. Block 3 replaces this with the real gate: compare the live database
// columns to docs/data-map.md and fail on any column the map does not list.
// Until a database exists, this only checks that the map still names the four tables.
const dataMapPath = fileURLToPath(new URL("../../../docs/data-map.md", import.meta.url));

describe("docs/data-map.md", () => {
  const text = readFileSync(dataMapPath, "utf8");
  const headings = [...text.matchAll(/^###\s+(\S+)\s*$/gm)].map((m) => m[1]);

  it.each(["accounts", "sessions", "tummy_logs", "audit_events"])(
    "has a table heading for %s",
    (table) => {
      expect(headings).toContain(table);
    },
  );
});
