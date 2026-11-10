// Renders the app icons (PNG) from the one placeholder SVG, apps/web/public/icons/icon.svg,
// with the Chromium that Playwright uses. Run it again after changing the SVG, then commit the
// PNGs. Nothing from outside this repo is drawn: no fonts, no third-party art.
//
// Runs in: a terminal, in the repo folder.
//   node scripts/render-icons.mjs
// In the Claude cloud container, set PW_CHROMIUM_PATH to the preinstalled Chromium first.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const webDir = resolve(import.meta.dirname, "../apps/web");
const iconsDir = join(webDir, "public/icons");
// @playwright/test is a dependency of apps/web, so load it from there.
const { chromium } = createRequire(join(webDir, "package.json"))("@playwright/test");

const svg = readFileSync(join(iconsDir, "icon.svg"));
const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;

// The art sits inside the middle 60%, so one drawing serves every purpose, maskable included
// (Android may cut the icon to a circle that keeps only the middle 80%).
const outputs = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  // iPhone home screen. iOS rounds the corners itself.
  { file: "apple-touch-icon.png", size: 180 },
];

const executablePath = process.env.PW_CHROMIUM_PATH;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  for (const { file, size } of outputs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<!doctype html><html><body style="margin:0"><img alt="" src="${src}" width="${String(size)}" height="${String(size)}" style="display:block"></body></html>`,
    );
    await page.locator("img").evaluate((img) => img.decode());
    writeFileSync(join(iconsDir, file), await page.screenshot({ type: "png" }));
    await page.close();
    console.log(`render-icons: wrote ${file} (${String(size)} x ${String(size)})`);
  }
} finally {
  await browser.close();
}
