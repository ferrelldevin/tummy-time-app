import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The web app manifest and index.html take their colors from the design tokens. A color changed
 * in one place and not the other fails here.
 */
const webDir = join(import.meta.dirname, "../..");
const tokens = readFileSync(join(webDir, "src/design/tokens.css"), "utf8");
const html = readFileSync(join(webDir, "index.html"), "utf8");

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
const manifest = JSON.parse(
  readFileSync(join(webDir, "public/manifest.webmanifest"), "utf8"),
) as Record<string, unknown> & { icons: ManifestIcon[] };

function token(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(tokens);
  if (!match?.[1]) throw new Error(`Missing token ${name}`);
  return match[1].toLowerCase();
}

/** Width and height from a PNG file's header. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii"), path).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("web app manifest", () => {
  it("takes its theme color from --color-primary and its background from --color-bg", () => {
    expect(manifest.theme_color).toBe(token("--color-primary"));
    expect(manifest.background_color).toBe(token("--color-bg"));
  });

  it("index.html carries the same theme color and links the manifest", () => {
    const meta = /<meta name="theme-color" content="(#[0-9a-fA-F]{6})"/.exec(html);
    expect(meta?.[1]?.toLowerCase()).toBe(token("--color-primary"));
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
  });

  it("opens at the start, on its own, within this site", () => {
    expect(manifest).toMatchObject({
      name: "Tummy Time",
      short_name: "Tummy Time",
      start_url: "/",
      scope: "/",
      display: "standalone",
    });
  });

  it("has 192 and 512 icons and a maskable 512, and each file is that size", () => {
    const wanted = [
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ];
    for (const [sizes, purpose] of wanted) {
      const icon = manifest.icons.find((i) => i.sizes === sizes && i.purpose === purpose);
      expect(icon, `${String(sizes)} ${String(purpose)}`).toBeDefined();
    }
    for (const icon of manifest.icons) {
      expect(icon.type).toBe("image/png");
      const [w, h] = icon.sizes.split("x").map(Number);
      expect(pngSize(join(webDir, "public", icon.src))).toEqual({ width: w, height: h });
    }
  });

  it("index.html has the iPhone home screen icon (180 px) and title", () => {
    expect(html).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Tummy Time" />');
    expect(pngSize(join(webDir, "public/icons/apple-touch-icon.png"))).toEqual({
      width: 180,
      height: 180,
    });
  });

  it("the placeholder icon is drawn only in token colors", () => {
    const svg = readFileSync(join(webDir, "public/icons/icon.svg"), "utf8");
    const used = new Set([...svg.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1]));
    const allowed = new Set(
      ["--color-primary", "--color-on-primary", "--color-bg"].map((n) => token(n)),
    );
    expect(used.size).toBeGreaterThan(0);
    for (const color of used) expect(allowed).toContain(color);
  });
});
