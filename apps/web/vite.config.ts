import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";
import { nextBuildPreview } from "./e2e/next-build-preview.ts";
import { buildIdPlugin } from "./tooling/build-id.ts";
import { pageSecurityHeaders } from "./tooling/page-headers.ts";

export default defineConfig(({ mode, isPreview }) => {
  // Read the shared .env at the repo root so web and api agree on ports.
  const env = loadEnv(mode, resolve(import.meta.dirname, "../.."), "");
  const apiTarget = `http://127.0.0.1:${env.API_PORT ?? "3001"}`;
  const webPort = Number(env.WEB_PORT ?? "5173");
  // SITE_BANNER=test shows "Test site. Sample data." on every screen (src/components/SiteBanner.tsx).
  // Read when the app is BUILT, never at run time, and off by default. Any other value stops the
  // build, so a typo cannot quietly leave the banner off on a test site.
  const siteBanner = (process.env.SITE_BANNER ?? env.SITE_BANNER ?? "").trim().toLowerCase();
  if (siteBanner !== "" && siteBanner !== "test") {
    throw new Error('SITE_BANNER must be empty or "test".');
  }
  const proxy = { "/api": { target: apiTarget, changeOrigin: false } };

  return {
    define: { __SITE_BANNER__: JSON.stringify(siteBanner) },
    plugins: [
      react(),
      // Writes the build's label into index.html (<meta name="tummy-build">), so a person or a
      // test can tell which version a phone is running. "local" unless TUMMY_BUILD_ID is set.
      buildIdPlugin(process.env.TUMMY_BUILD_ID ?? "local"),
      // The service worker (Block 7). Rules, set by the senior reviewer for threat model #17:
      // - Precache every built file, lazily loaded lesson and log files included, so after one
      //   visit with signal every screen opens with none. Lessons and the safety card are
      //   compiled into those files, so content and code are always one version.
      // - No runtime caching at all. Nothing under /api/ is ever cached by the worker; this
      //   phone's only offline data is the IndexedDB copy of the log (docs/data-map.md).
      // - "prompt": a new version waits until src/update/ lets it in (a button, or a safe
      //   moment). It never takes over by itself, so it can never reload under a running timer.
      // scripts/check-precache.mjs checks the built worker against these rules.
      VitePWA({
        strategies: "generateSW",
        registerType: "prompt",
        // We register the worker ourselves (src/update/service-worker.ts), not with the plugin's
        // helper: we need to tell a fresh start from a later update and check, at the last
        // moment before a reload, that no timer is running.
        injectRegister: false,
        // The manifest is our own file, public/manifest.webmanifest, kept in step with the
        // design tokens by src/install/manifest.test.ts.
        manifest: false,
        // Never in the dev server: the style guide and hot reload live there.
        devOptions: { enabled: false },
        workbox: {
          globPatterns: ["**/*.{js,css,html,webmanifest,png,svg}"],
          // Any screen opened with no signal gets the cached page; the app then routes it.
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [],
          cleanupOutdatedCaches: true,
          // On the very first install there is no older version to mix with, so the worker
          // takes charge of the open page at once and later lazy files come from the cache.
          clientsClaim: true,
          skipWaiting: false,
          // The lesson files are the largest; this keeps a mistake (a huge file) from being
          // skipped silently: the build would then miss a screen offline.
          maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        },
      }),
      // Browser tests only (playwright.config.ts sets E2E_NEXT_BUILD_DIR): lets one test's
      // browser see a second build, to test the update flow. Never in production (nginx).
      ...(process.env.E2E_NEXT_BUILD_DIR ? [nextBuildPreview(process.env.E2E_NEXT_BUILD_DIR)] : []),
    ],
    // Bind to 127.0.0.1 by number. "localhost" can mean ::1 (IPv6) on some machines, including
    // GitHub's CI runners, and then nothing answers on 127.0.0.1.
    server: { host: "127.0.0.1", port: webPort, strictPort: true, proxy },
    preview: {
      host: "127.0.0.1",
      port: Number(env.WEB_PREVIEW_PORT ?? "4173"),
      strictPort: true,
      proxy,
      // The same security headers nginx sends with the page, read from nginx's own file
      // (tooling/page-headers.ts), so the browser tests run under the real Content Security
      // Policy (e2e/policy.spec.ts) and the real Referrer-Policy, which can change the Origin
      // header a browser sends and the API checks.
      // Read only when previewing: a build (and the Docker build, which has no infra/ folder)
      // never needs the file.
      ...(isPreview ? { headers: pageSecurityHeaders() } : {}),
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}", "tooling/**/*.test.ts"],
      setupFiles: ["src/test/setup.ts"],
    },
  };
});
