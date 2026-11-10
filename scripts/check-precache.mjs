// Checks the built service worker (apps/web/dist/sw.js) against the caching rules the senior
// reviewer set in Block 7 (threat model #17, docs/data-map.md "On the phone"):
// 1. Every file a screen needs is cached, lazily loaded lesson and log files included.
// 2. Nothing under /api/ is cached, and there are no runtime caching rules at all: the only
//    route is the page fallback, and it skips /api/.
// 3. The worker never takes over by itself: skipWaiting runs only when the page asks.
// It also prints how much a phone stores after its first visit.
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { distDir, precacheUrls, readServiceWorker } from "./precache-list.mjs";

const sw = readServiceWorker();
if (sw === null) {
  console.error("check-precache: apps/web/dist/sw.js not found. Run `pnpm build` first.");
  process.exit(1);
}

const problems = [];
const urls = precacheUrls(sw);
const listed = new Set(urls);

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

// 1. Every built file a screen can ask for is in the list, and every listed file exists.
const cacheable = /\.(js|css|html|webmanifest|png|svg)$/;
const workerFiles = /^(sw\.js|workbox-[\w-]+\.js)$/;
const built = new Set();
for (const path of files(distDir)) {
  const url = relative(distDir, path).split(sep).join("/");
  if (!cacheable.test(url) || workerFiles.test(url)) continue;
  built.add(url);
  if (!listed.has(url)) problems.push(`${url} is built but not cached for offline use.`);
}
for (const url of urls) {
  if (!built.has(url)) problems.push(`${url} is in the cache list but not in the build.`);
}
for (const required of ["index.html", "manifest.webmanifest"]) {
  if (!listed.has(required)) problems.push(`${required} is not cached.`);
}

// 2. No API answers, ever, and no runtime caching rules.
for (const url of urls) {
  if (/(^|\/)api\//.test(url)) problems.push(`${url} looks like an API address.`);
}
const routes = sw.match(/registerRoute\(/g)?.length ?? 0;
if (routes !== 1) {
  problems.push(`sw.js registers ${String(routes)} routes; only the page fallback is allowed.`);
}
if (!sw.includes("registerRoute(new e.NavigationRoute(")) {
  problems.push("The one route in sw.js is not the page fallback (NavigationRoute).");
}
if (!sw.includes("denylist:[/^\\/api\\//]")) {
  problems.push("The page fallback in sw.js does not skip /api/.");
}
for (const strategy of [
  "NetworkFirst",
  "NetworkOnly",
  "CacheFirst",
  "CacheOnly",
  "StaleWhileRevalidate",
]) {
  if (sw.includes(strategy)) problems.push(`sw.js uses ${strategy}: a runtime caching rule.`);
}

// 3. A new version waits for the page. skipWaiting appears once, inside the message handler.
const skips = sw.match(/skipWaiting\(\)/g)?.length ?? 0;
if (skips !== 1 || !/"SKIP_WAITING"===e\.data\.type&&self\.skipWaiting\(\)/.test(sw)) {
  problems.push("sw.js may take over by itself: skipWaiting() outside the SKIP_WAITING message.");
}

if (problems.length > 0) {
  for (const p of problems) console.error(`check-precache: FAIL. ${p}`);
  process.exit(1);
}
const bytes = urls.reduce((sum, url) => sum + statSync(join(distDir, url)).size, 0);
console.log(
  `check-precache: OK. ${String(urls.length)} files cached for offline use, ${(bytes / 1024).toFixed(1)} KB, no API addresses, no runtime caching.`,
);
