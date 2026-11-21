import { defineConfig, devices } from "@playwright/test";

// Browser tests for the client demo build (docs/demo.md): the whole click path on two phone
// sizes, axe on every screen, and no Content Security Policy errors. The demo has no server:
// `vite preview` only serves dist-demo with the same security headers as nginx.
// Run: pnpm test:e2e:demo  (Chromium preinstalled elsewhere: set PW_CHROMIUM_PATH.)
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e-demo",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    { name: "android", use: { ...devices["Pixel 5"] } },
    { name: "small-phone", use: { ...devices["Pixel 5"], viewport: { width: 320, height: 640 } } },
  ],
  webServer: {
    command:
      "node scripts/build-demo.mjs && DEMO=1 pnpm --filter @tummy/web exec vite preview --port 4175",
    cwd: "../..",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
