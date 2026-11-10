// Fails if the development-only style guide leaked into the production build.
// It looks for text that exists only in the style guide page and its strings.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const distDir = resolve(import.meta.dirname, "../apps/web/dist");
const markers = ["Style guide (development only)", "sg-swatch", "Example dialog text"];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* files(path);
    } else {
      yield path;
    }
  }
}

let scanned = 0;
let leaked = false;
try {
  for (const file of files(distDir)) {
    scanned += 1;
    const text = readFileSync(file, "utf8");
    for (const marker of markers) {
      if (text.includes(marker)) {
        console.error(`check-no-styleguide: FAIL. "${marker}" found in ${file}`);
        leaked = true;
      }
    }
  }
} catch {
  console.error("check-no-styleguide: apps/web/dist not found. Run `pnpm build` first.");
  process.exit(1);
}
if (leaked) {
  process.exit(1);
}
console.log(`check-no-styleguide: OK. No style guide text in ${scanned} built files.`);
