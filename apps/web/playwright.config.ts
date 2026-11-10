import { defineConfig, devices } from "@playwright/test";

// In CI the browser is installed with `playwright install`. In the Claude cloud container
// Chromium is preinstalled elsewhere; set PW_CHROMIUM_PATH to its executable to use it.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Pixel 5"],
    viewport: { width: 390, height: 844 },
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [
    {
      // The built app, as a caregiver gets it. The style guide must NOT be here.
      name: "phone",
      testIgnore: /styleguide\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:4173" },
    },
    {
      // The development server, which is the only place /styleguide exists.
      name: "dev-phone",
      testMatch: /styleguide\.spec\.ts/,
      use: { baseURL: "http://127.0.0.1:5273" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @tummy/api exec tsx src/server.ts",
      cwd: "../..",
      url: "http://127.0.0.1:3101/api/health",
      // The real family-code-pin provider. APP_ORIGIN is the built app's address below, the only
      // page that sends state-changing requests in these tests. CODE_LOOKUP_SECRET comes from the
      // environment (CI makes a fresh one per run; locally it is in .env).
      env: {
        API_PORT: "3101",
        LOG_LEVEL: "silent",
        NODE_ENV: "test",
        APP_ORIGIN: "http://127.0.0.1:4173",
        AUTH_PROVIDER: "family-code-pin",
      },
      reuseExistingServer: false,
    },
    {
      command:
        "pnpm --filter @tummy/web exec vite build && pnpm --filter @tummy/web exec vite preview",
      cwd: "../..",
      url: "http://127.0.0.1:4173",
      env: { API_PORT: "3101" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @tummy/web exec vite",
      cwd: "../..",
      url: "http://127.0.0.1:5273",
      env: { API_PORT: "3101", WEB_PORT: "5273" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
