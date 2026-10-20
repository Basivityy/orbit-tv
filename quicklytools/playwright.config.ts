import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a running server (BASE_URL, default http://localhost:3000).
 * Cross-browser: chromium, firefox, webkit (Safari engine), plus mobile emulation.
 * Install browsers locally with `npx playwright install --with-deps`.
 * Select projects with `--project=chromium` etc. Edge uses Chromium (`channel: "msedge"` when installed).
 */
const exe = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: exe ? { executablePath: exe } : undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "edge", use: { ...devices["Desktop Edge"], channel: "msedge" } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
});
