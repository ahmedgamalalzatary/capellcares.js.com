import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/staging/critical",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.STAGING_BASE_URL,
    trace: "retain-on-failure"
  }
});
