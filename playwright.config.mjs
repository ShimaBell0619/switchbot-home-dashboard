import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const hostedBaseURL = process.env.UI_REVIEW_BASE_URL?.trim();
const localBaseURL = "http://127.0.0.1:3100";
const backendURL = JSON.parse(
  readFileSync(new URL("./vercel.json", import.meta.url), "utf8"),
).env.AZURE_BACKEND_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: hostedBaseURL || localBaseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: hostedBaseURL
    ? undefined
    : {
        command: "npm run start -- -p 3100 -H 127.0.0.1",
        url: localBaseURL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
        env: { AZURE_BACKEND_BASE_URL: backendURL },
      },
});
