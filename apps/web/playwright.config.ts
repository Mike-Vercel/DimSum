import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Test accounts (SEED_*) and TEST_DATABASE_URL come from the monorepo .env locally, from CI secrets otherwise.
const envFile = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const port = Number(process.env.E2E_PORT ?? 3100);
// Locally the installed Chrome is used; CI installs Playwright's Chromium.
const channel = process.env.CI ? {} : { channel: "chrome" as const };

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  // One shared database: flows run one after the other.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "api", testMatch: /api\/.*\.spec\.ts/, use: { ...channel } },
    { name: "mobile", testMatch: /flows\/.*\.spec\.ts/, use: { ...devices["Pixel 7"], ...channel } },
  ],
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `http://localhost:${port}/api/v1/health`,
    timeout: 900_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
