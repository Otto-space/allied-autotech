import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";
process.env.RUN_CONSOLIDATED_AUDIT_FIXTURES = "true";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["consolidated-audit*.spec.ts", "learning-destinations.spec.ts"],
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  outputDir: path.join(
    os.tmpdir(),
    process.env.AUDIT_RUN_ID ?? "allied-consolidated-audit-20261103-final",
  ),
  reporter: [
    ["list"],
    [
      "json",
      {
        outputFile: path.join(
          os.tmpdir(),
          (process.env.AUDIT_RUN_ID ?? "allied-consolidated-audit-20261103-final") +
            "-results.json",
        ),
      },
    ],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3197",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "edge", use: { browserName: "chromium", channel: "msedge" } },
    { name: "chrome", use: { browserName: "chromium", channel: "chrome" } },
  ],
});
