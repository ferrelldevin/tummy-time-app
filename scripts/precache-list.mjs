// Reads the list of files the built service worker caches (its "precache list") from
// apps/web/dist/sw.js. Used by check-precache.mjs and check-no-styleguide.mjs.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const distDir = resolve(import.meta.dirname, "../apps/web/dist");

/** The service worker's source, or null when there is no build. */
export function readServiceWorker() {
  try {
    return readFileSync(join(distDir, "sw.js"), "utf8");
  } catch {
    return null;
  }
}

/**
 * The URLs in the worker's precacheAndRoute([...]) call, as written there (relative to the
 * site root). Throws if the call cannot be found, so a change in the generated file's shape
 * fails loudly instead of checking an empty list.
 */
export function precacheUrls(sw) {
  const start = sw.indexOf("precacheAndRoute([");
  const end = start === -1 ? -1 : sw.indexOf("]", start);
  if (start === -1 || end === -1) {
    throw new Error("precacheAndRoute([...]) not found in sw.js");
  }
  const list = sw.slice(start, end);
  const urls = [...list.matchAll(/url:"([^"]+)"/g)].map((m) => m[1]);
  if (urls.length === 0) {
    throw new Error("The precache list in sw.js is empty.");
  }
  return urls;
}
