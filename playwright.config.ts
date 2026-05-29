import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests live under `e2e/`. By default we boot the Next dev server on
 * 127.0.0.1:3100 ourselves so a fresh `npx playwright test` works without
 * manual setup. Set `PLAYWRIGHT_BASE_URL` to skip the webServer and point at
 * an already-running instance (e.g. staging, or a prod build you started).
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const useExternalServer = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run dev -- --port 3100",
        url: "http://127.0.0.1:3100/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
