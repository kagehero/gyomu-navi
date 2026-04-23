import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests: add `*.spec.ts` under `e2e/`. The default `webServer` is disabled;
 * set `CI=1` or use `npx playwright test` with a running `npm run dev` if needed.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
