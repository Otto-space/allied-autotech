import { defineConfig } from "@playwright/test";

process.env.CAPABILITY_TEST_CONTROL_ORIGIN = "http://127.0.0.1:5024";
process.env.CAPABILITY_TEST_TRANSPORT = "loopback";

export default defineConfig({
  testDir: "./tests/e2e",
  projects: [
    {
      name: "home-design",
      testMatch: ["home-design.spec.ts"],
    },
    {
      name: "product-authoring",
      testMatch: ["work-products.spec.ts"],
      grep: /product estimates validate|edit stays locked/,
      timeout: 60_000,
      expect: { timeout: 15_000 },
    },
    {
      name: "product-timing",
      testMatch: ["product-timing.spec.ts"],
      timeout: 60_000,
      expect: { timeout: 15_000 },
    },
    {
      name: "product-touch",
      testMatch: ["work-products.spec.ts"],
      grep: /product estimates validate, review and persist at 320px/,
      use: { hasTouch: true },
      timeout: 60_000,
      expect: { timeout: 15_000 },
    },
    {
      name: "runtime",
      testMatch: [
        "runtime-capabilities.spec.ts",
        "public-search-recovery.spec.ts",
        "public-navigation-readiness.spec.ts",
        "appointment-export.spec.ts",
        "booking-reschedule-approval.spec.ts",
        "workforce-booking-reschedule.spec.ts",
        "booking-timing.spec.ts",
        "booking-attendance.spec.ts",
        "booking-work-review.spec.ts",
        "service-payment-stages.spec.ts",
        "booking-calendar.spec.ts",
        "invoice-modal-responsive.spec.ts",
        "modal-layout.spec.ts",
        "catalogue-modal-layout.spec.ts",
        "service-timing.spec.ts",
        "slot-timing-review.spec.ts",
        "customer-support-actions.spec.ts",
        "customer-overview-selection.spec.ts",
        "customer-overview-attention.spec.ts",
        "shared-shell-dock.spec.ts",
        "workforce-directory.spec.ts",
        "saved-items-navigation.spec.ts",
        "saved-items-quality.spec.ts",
        "customer-profile-quality.spec.ts",
        "profile-revision.spec.ts",

        "order-money-breakdown.spec.ts",
        "workshop-resources.spec.ts",
      ],
    },
    {
      name: "late-alternatives",
      testMatch: ["workforce-booking-confirmation.spec.ts"],
      grep: /proposes a reviewed|uncertain workforce proposal|proposal rechecks|available alternatives|late alternative ignores/,
    },
    {
      name: "legacy-attendance",
      testMatch: ["staff-bookings.spec.ts"],
      grep: /staff verifies missed attendance|alternative appointment|vehicle collection/,
    },
    {
      name: "additional-service-quotes",
      testMatch: ["quotation-quality.spec.ts", "customer-booking-detail-quality.spec.ts"],
      grep: /additional quotation/,
    },
    {
      name: "modal-consumers",
      testMatch: [
        "customer-garage-quality.spec.ts",
        "work-invoice-detail.spec.ts",
        "purchase-guest-documents.spec.ts",
        "customers-care.spec.ts",
        "product-extras.spec.ts",
        "order-detail-quality.spec.ts",
        "learning-interactions.spec.ts",
        "about-evidence.spec.ts",
      ],
      grep: /short modal|pending save prevents|download is version-bound|guest invoice download|reviews authoritative|populated gallery|dialog closes with Escape|cancellation in flight|Practice feedback|Allie revalidation|About principles/,
    },
    ...(["firefox", "webkit"] as const).map((browserName) => ({
      name: `responsive-${browserName}`,
      use: {
        browserName,
        ...(browserName === "webkit"
          ? {
              baseURL: "https://127.0.0.1:3104",
              // Ephemeral self-signed loopback certificate; production CSP stays on.
              ignoreHTTPSErrors: true,
            }
          : {}),
      },
      // Reuse the same production build and isolated API. These are engine
      // checks on Linux CI, not branded Safari or physical-phone acceptance.
      testMatch: [
        "shared-shell-dock.spec.ts",
        "booking-calendar.spec.ts",
        "invoice-modal-responsive.spec.ts",
        "modal-layout.spec.ts",
        "catalogue-modal-layout.spec.ts",
        "public-search-recovery.spec.ts",
        "public-navigation-readiness.spec.ts",
        "saved-items-navigation.spec.ts",
      ],
    })),
    ...(["firefox", "webkit"] as const).map((browserName) => ({
      name: `profile-${browserName}`,
      testMatch: ["customer-profile-quality.spec.ts", "profile-revision.spec.ts"],
      use: {
        browserName,
        ...(browserName === "webkit"
          ? { baseURL: "https://127.0.0.1:3104", ignoreHTTPSErrors: true }
          : {}),
      },
    })),
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: `media-contract-${browserName}`,
      testMatch: [
        "consolidated-audit-boundaries.spec.ts",
        "customer-garage-quality.spec.ts",
        "public-reviews-quality.spec.ts",
      ],
      grep: /private portrait|managed own profile|owned garage photos|public review portrait/,
      use: {
        browserName,
        ...(browserName === "webkit"
          ? { baseURL: "https://127.0.0.1:3104", ignoreHTTPSErrors: true }
          : {}),
      },
    })),
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
        // Reuse the exact production-check build. Its rewrite keeps the CI
        // placeholder, so browser fixtures explicitly route API calls to loopback.
        BACKEND_ORIGIN: "http://127.0.0.1:5024",
        // Reserved, non-routable fixture host: enable file selection without
        // supplying credentials or allowing any real object-storage upload.
        ASSET_STORAGE_HOSTS: "storage.invalid",
        VERCEL: "",
        VERCEL_ENV: "development",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
    {
      command: "node tests/fixtures/runtime-capabilities-https.mjs",
      url: "https://127.0.0.1:3104/__runtime_tls_health",
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
