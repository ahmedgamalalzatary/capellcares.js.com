import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:8081",
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "pnpm exec expo start --web --localhost --port 8081",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { EXPO_PUBLIC_API_URL: "http://localhost:4000", CI: "1" }
  }
});
