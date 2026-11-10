// Fails if the development-only style guide leaked into the production build.
// It looks for text that exists only in the style guide page and its strings, and for any
// style guide file in the service worker's list of files it keeps on the phone.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { distDir, precacheUrls, readServiceWorker } from "./precache-list.mjs";
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

const sw = readServiceWorker();
if (sw === null) {
  console.error("check-no-styleguide: apps/web/dist/sw.js not found. Run `pnpm build` first.");
  process.exit(1);
}
const cached = precacheUrls(sw);
for (const url of cached) {
  if (/styleguide/i.test(url)) {
    console.error(`check-no-styleguide: FAIL. The service worker caches ${url}`);
    leaked = true;
  }
}
if (leaked) {
  process.exit(1);
}
console.log(
  `check-no-styleguide: OK. No style guide text in ${scanned} built files, and none of the ${cached.length} files the service worker caches is a style guide file.`,
);
