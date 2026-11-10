import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  // Read the shared .env at the repo root so web and api agree on ports.
  const env = loadEnv(mode, resolve(import.meta.dirname, "../.."), "");
  const apiTarget = `http://127.0.0.1:${env.API_PORT ?? "3001"}`;
  const webPort = Number(env.WEB_PORT ?? "5173");
  const proxy = { "/api": { target: apiTarget, changeOrigin: false } };

  return {
    plugins: [react()],
    // Bind to 127.0.0.1 by number. "localhost" can mean ::1 (IPv6) on some machines, including
    // GitHub's CI runners, and then nothing answers on 127.0.0.1.
    server: { host: "127.0.0.1", port: webPort, strictPort: true, proxy },
    preview: {
      host: "127.0.0.1",
      port: Number(env.WEB_PREVIEW_PORT ?? "4173"),
      strictPort: true,
      proxy,
    },
    test: {
      environment: "jsdom",
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["src/test/setup.ts"],
    },
  };
});
