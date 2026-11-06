import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    url: "http://localhost:3100",
    command: "npm run dev -- --port 3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
