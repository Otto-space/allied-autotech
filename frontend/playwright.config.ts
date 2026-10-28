import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir:
    process.env.PLAYWRIGHT_OUTPUT_DIR ??
    path.join(
      os.tmpdir(),
      "allied-autotech-playwright",
      createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12),
    ),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    channel: process.platform === "win32" ? "msedge" : undefined,
    headless: true,
    trace: "retain-on-failure",
  },
  reporter: "list",
});
