import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

const css = readFileSync(join(import.meta.dirname, "tokens.css"), "utf8");

/** The day theme is everything before the night block; the night block only overrides. */
const NIGHT = "@media (prefers-color-scheme: dark)";
const dayCss = css.slice(0, css.indexOf(NIGHT));
const nightCss = css.slice(css.indexOf(NIGHT));

function read(text: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const m of text.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, value] = m;
    if (name && value) {
      found[name] = value;
    }
  }
  return found;
}

let theme: "day" | "night" = "day";

/** The colors of the theme under test: night takes the day colors it does not override. */
function colors(): Record<string, string> {
  return theme === "day" ? read(dayCss) : { ...read(dayCss), ...read(nightCss) };
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
  ["--color-on-primary", "--color-primary-strong"],
  ["--color-text", "--color-teal-soft"],
  ["--color-text", "--color-sun-soft"],
  ["--color-text", "--color-sage-soft"],
  ["--color-text", "--color-lilac-soft"],
  ["--color-text-muted", "--color-teal-soft"],
  ["--color-text-muted", "--color-sun-soft"],
  ["--color-text-muted", "--color-sage-soft"],
  ["--color-text-muted", "--color-lilac-soft"],
  ["--color-link", "--color-teal-soft"],
  ["--color-link", "--color-sun-soft"],
  ["--color-link", "--color-sage-soft"],
  ["--color-link", "--color-lilac-soft"],
  ["--color-primary", "--color-teal-soft"],
];

// Lines and focus rings are not text, so WCAG asks for 3:1 against what is next to them.
const lineBackgrounds = ["--color-bg", "--color-surface"];
const lineColors = ["--color-border", "--color-focus", "--color-primary"];

describe.each(["day", "night"] as const)("design tokens: contrast, %s theme", (which) => {
  beforeEach(() => {
    theme = which;
  });

  it("reads colors from tokens.css", () => {
    expect(Object.keys(colors()).length).toBeGreaterThan(10);
  });

  it("the night theme overrides every text and surface color", () => {
    const night = read(nightCss);
    for (const [fg, bg] of textPairs) {
      expect(night[fg], fg).toBeDefined();
      expect(night[bg], bg).toBeDefined();
    }
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
