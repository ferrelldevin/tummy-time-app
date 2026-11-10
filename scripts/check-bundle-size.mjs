// Fails if the gzipped JavaScript needed for first load is over the budget.
// First load = every script and modulepreload that apps/web/dist/index.html points at.
// Block 2 sets the real budget; 150 KB gzipped is the starting limit from the build plan.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";

const BUDGET_BYTES = 150 * 1024;
const distDir = resolve(import.meta.dirname, "../apps/web/dist");

let html;
try {
  html = readFileSync(join(distDir, "index.html"), "utf8");
} catch {
  console.error("check-bundle-size: apps/web/dist/index.html not found. Run `pnpm build` first.");
  process.exit(1);
}

const refs = new Set();
for (const match of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+\.js)"[^>]*>/g)) {
  refs.add(match[1]);
}
if (refs.size === 0) {
  console.error("check-bundle-size: found no JavaScript referenced by index.html.");
  process.exit(1);
}

let total = 0;
for (const ref of refs) {
  const gzipped = gzipSync(readFileSync(join(distDir, ref.replace(/^\//, "")))).length;
  total += gzipped;
  console.log(`${ref}: ${(gzipped / 1024).toFixed(1)} KB gzipped`);
}
const kb = (total / 1024).toFixed(1);
if (total > BUDGET_BYTES) {
  console.error(
    `check-bundle-size: FAIL. First-load JS is ${kb} KB gzipped, over the 150 KB budget.`,
  );
  process.exit(1);
}
console.log(`check-bundle-size: OK. First-load JS is ${kb} KB gzipped (budget 150 KB).`);
