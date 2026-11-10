import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { Plugin } from "vite";
import { pageSecurityHeaders } from "../tooling/page-headers.ts";

/** The cookie a browser test sets to be served the second build. */
export const NEXT_BUILD_COOKIE = "e2e-build=next";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/**
 * BROWSER TESTS ONLY. playwright.config.ts builds the app twice: the normal build in dist/, and a
 * second one, with a different build label, in the folder named here. A browser that carries
 * the cookie above is served the second build, as if a new version had been deployed; every
 * other browser keeps getting dist/. That lets the update test (e2e/update.spec.ts) run beside
 * the other tests without changing what they see.
 *
 * The cookie reaches every request the update needs: the page, the service worker script the
 * browser fetches to look for a new version, and the files the new worker caches.
 *
 * vite.config.ts adds this only when E2E_NEXT_BUILD_DIR is set, which only the test config
 * does. Production is served by nginx and never runs it.
 */
export function nextBuildPreview(dir: string): Plugin {
  const root = resolve(dir);
  return {
    name: "tummy-e2e-next-build",
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://preview");
        const wantsNext = (req.headers.cookie ?? "").split(/;\s*/).includes(NEXT_BUILD_COOKIE);
        if (!wantsNext || url.pathname.startsWith("/api/")) {
          next();
          return;
        }
        const candidate = normalize(join(root, decodeURIComponent(url.pathname)));
        if (candidate !== root && !candidate.startsWith(root + sep)) {
          res.statusCode = 404;
          res.end();
          return;
        }
        const isFile = existsSync(candidate) && statSync(candidate).isFile();
        // Like the normal preview: an address that is not a file gets the page.
        const file = isFile ? candidate : join(root, "index.html");
        if (!isFile && extname(url.pathname) !== "") {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
        for (const [name, value] of Object.entries(pageSecurityHeaders())) {
          res.setHeader(name, value);
        }
        res.end(readFileSync(file));
      });
    },
  };
}
