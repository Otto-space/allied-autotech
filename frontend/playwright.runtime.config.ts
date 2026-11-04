import { defineConfig } from "@playwright/test";

process.env.CAPABILITY_TEST_CONTROL_ORIGIN = "http://127.0.0.1:5024";
process.env.CAPABILITY_TEST_TRANSPORT = "loopback";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "runtime-capabilities.spec.ts",
    "appointment-export.spec.ts",
    "booking-reschedule-approval.spec.ts",
    "workforce-booking-reschedule.spec.ts",
    "booking-timing.spec.ts",
    "booking-work-review.spec.ts",
    "service-timing.spec.ts",
    "slot-timing-review.spec.ts",
    "customer-support-actions.spec.ts",
    "customer-overview-selection.spec.ts",
    "customer-overview-attention.spec.ts",
    "shared-shell-dock.spec.ts",

    "order-money-breakdown.spec.ts",
    "workshop-resources.spec.ts",
  ],
  outputDir: "./test-results/runtime-capabilities",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3103",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [
    ["list"],
    ["json", { outputFile: "./test-results/runtime-capabilities/results.json" }],
  ],
  webServer: [
    {
      command: "node tests/fixtures/runtime-capabilities-api.mjs",
      url: "http://127.0.0.1:5024/__health",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command:
        "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3103",
      url: "http://127.0.0.1:3103",
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        // Reuse the exact production-check build. Browser API calls are sent to
        // the same loopback fixture because the built rewrite retains CI's origin.
        BACKEND_ORIGIN: "http://127.0.0.1:5024",
        VERCEL: "",
        VERCEL_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
