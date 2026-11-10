import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const css = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

/** Reads `--name: #rrggbb;` lines from tokens.css. */
function colors(): Record<string, string> {
  const found: Record<string, string> = {};
  for (const m of css.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = m;
    if (name && value) {
      found[name] = value;
    }
  }
  return found;
}

function ratio(fg: string, bg: string): number {
  const c = colors();
  const a = c[fg];
  const b = c[bg];
  if (!a || !b) {
    throw new Error(`Missing token: ${fg} or ${bg}`);
  }
  return contrastRatio(a, b);
}

// Every place text is drawn on a background: [text token, background token].
const textPairs: [string, string][] = [
  ["--color-text", "--color-bg"],
  ["--color-text", "--color-surface"],
  ["--color-text", "--color-info-bg"],
  ["--color-text", "--color-success-bg"],
  ["--color-text", "--color-danger-bg"],
  ["--color-text-muted", "--color-bg"],
  ["--color-text-muted", "--color-surface"],
  ["--color-link", "--color-bg"],
  ["--color-link", "--color-surface"],
  ["--color-danger", "--color-bg"],
  ["--color-danger", "--color-surface"],
  ["--color-danger", "--color-danger-bg"],
  ["--color-success", "--color-success-bg"],
  ["--color-on-primary", "--color-primary"],
  ["--color-on-accent", "--color-accent"],
];

// Lines and focus rings are not text, so WCAG asks for 3:1 against what is next to them.
const lineBackgrounds = ["--color-bg", "--color-surface"];
const lineColors = ["--color-border", "--color-focus", "--color-primary"];

describe("design tokens: contrast", () => {
  it("reads colors from tokens.css", () => {
    expect(Object.keys(colors()).length).toBeGreaterThan(10);
  });

  it.each(textPairs)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  for (const line of lineColors) {
    for (const bg of lineBackgrounds) {
      it(`${line} on ${bg} is at least 3:1`, () => {
        expect(ratio(line, bg)).toBeGreaterThanOrEqual(3);
      });
    }
  }

  it("the contrast function is right on known values", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("design tokens: sizes", () => {
  it("every font size is in rem and none is below 1rem", () => {
    const sizes = [...css.matchAll(/--font-size-[a-z0-9]+:\s*([^;]+);/g)].map((m) => m[1] ?? "");
    expect(sizes.length).toBeGreaterThanOrEqual(5);
    for (const size of sizes) {
      expect(size).toMatch(/^[0-9.]+rem$/);
      expect(parseFloat(size)).toBeGreaterThanOrEqual(1);
    }
  });

  it("the tap target minimum is 44 px at the default font size", () => {
    const m = /--target-min:\s*([0-9.]+)rem/.exec(css);
    expect(parseFloat(m?.[1] ?? "0") * 16).toBeGreaterThanOrEqual(44);
  });
});
