import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: ".test-build/browser",
  use: {
    baseURL: process.env.OVANTO_UI_TEST_BASE_URL ?? "http://localhost:3100",
    browserName: "chromium",
    channel: "chrome",
    headless: true,
    serviceWorkers: "block",
    screenshot: "only-on-failure",
  },
});
