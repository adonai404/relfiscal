import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const CHROMIUM_EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? (existsSync("/bin/chromium") ? "/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    launchOptions: CHROMIUM_EXECUTABLE ? { executablePath: CHROMIUM_EXECUTABLE } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // The webServer is optional; if E2E_BASE_URL points to an already-running
  // preview (e.g. the Lovable preview), we don't need to spin one up.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: `bun run preview --port ${PORT} --host 127.0.0.1`,
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});