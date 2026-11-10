import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = resolve(import.meta.dirname, "../src");

describe("where schema files get Zod from", () => {
  it("only src/zod.ts imports the zod package; every other file imports ./zod.js", () => {
    const direct = readdirSync(src, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".ts") && name !== "zod.ts")
      .filter((name) =>
        /(from\s+|import\s*\(\s*|import\s+)["']zod(\/[^"']*)?["']/.test(
          readFileSync(resolve(src, name), "utf8"),
        ),
      );
    expect(direct).toEqual([]);
  });

  it("leaves Zod's faster checking on outside a browser (the API)", async () => {
    const { z } = await import("../src/zod.js");
    expect("document" in globalThis).toBe(false);
    expect(z.config().jitless).not.toBe(true);
  });
});
