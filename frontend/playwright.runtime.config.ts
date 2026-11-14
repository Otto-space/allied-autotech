import { defineConfig } from "@playwright/test";

process.env.CAPABILITY_TEST_CONTROL_ORIGIN = "http://127.0.0.1:5024";
process.env.CAPABILITY_TEST_TRANSPORT = "loopback";

export default defineConfig({
  testDir: "./tests/e2e",
  projects: [
    {
      name: "brand-palette",
      testMatch: ["colour-states.spec.ts"],
    },
    {
      name: "privacy-review",
      testMatch: ["work-privacy.spec.ts"],
    },
    {
      name: "processing-job-suppression",
      testMatch: ["work-processing-jobs.spec.ts"],
    },
    {
      name: "parts-design",
      testMatch: ["parts-design.spec.ts"],
    },
    {
      name: "vehicle-engine-features",
      testMatch: [
        "vehicle-engine-features.spec.ts",
        "vehicle-public-engine.spec.ts",
        "vehicles-quality.spec.ts",
      ],
      grep: /vehicle engine|engine details and feature draft|public (BEV|ICE) engine|power, legacy fuel/,
    },
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: `account-modal-${browserName}`,
      testMatch: [
        "customer-account-modal.spec.ts",
        "customer-confirmation-focus.spec.ts",
      ],
      use: {
        browserName,
        ...(browserName === "webkit"
          ? { baseURL: "https://127.0.0.1:3104", ignoreHTTPSErrors: true }
          : {}),
      },
    })),
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: `sidebar-breakpoint-${browserName}`,
      testMatch: ["dashboard-navigation.spec.ts"],
      grep: /sidebar preserves the desktop choice across mobile|sidebar restores browser-evicted focus/,
      use: {
        browserName,
        ...(browserName === "webkit"
          ? { baseURL: "https://127.0.0.1:3104", ignoreHTTPSErrors: true }
          : {}),
      },
    })),
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: `quotation-modal-${browserName}`,
      testMatch: ["staff-quotation-modal.spec.ts"],
      use: {
        browserName,
        ...(browserName === "webkit"
          ? { baseURL: "https://127.0.0.1:3104", ignoreHTTPSErrors: true }
          : {}),
      },
    })),
    ...(["chromium", "firefox", "webkit"] as const).map((browserName) => ({
      name: `payment-modal-${browserName}`,
      testMatch: ["payment-detail-quality.spec.ts"],
      grep: /payment review geometry/,
      use: {
        browserName,
        ...(browserName === "webkit"
          ? { baseURL: "https://127.0.0.1:3104", ignoreHTTPSErrors: true }
          : {}),
      },
    })),
    {
      name: "services-design",
      testMatch: ["services-design.spec.ts"],
    },
    {
      name: "authentication-lifecycle",
      testMatch: [
        "auth-forms.spec.ts",
        "login-quality.spec.ts",
        "forgot-password-quality.spec.ts",
        "reset-password-quality.spec.ts",
        "mfa.spec.ts",
        "authenticator-replacement.spec.ts",
      ],
      // Match the synthetic WebAuthn RP without changing application policy.
      // This project uses the same loopback production server and build.
      use: { baseURL: "http://localhost:3103" },
      grep: /registration completes|verification token|accepted request is generic|Retry-After blocks|duplicate submission locks|complete reset|invalid link clears|uncertain .* result|pending session selects|invalid codes clear|recovery code uses|first-factor setup requires|discarding authenticator|late enrollment|malformed enrollment|virtual security key|cancelled browser|existing factor blocks|re-register authenticator|password reveal is reversible|pending submission clears|honest .* response|invalid .* response cannot|MFA hands off|safe continuation|session change clears/,
    },
    {
      name: "account-design",
      testMatch: [
        "login-quality.spec.ts",
        "register-quality.spec.ts",
        "forgot-password-quality.spec.ts",
        "reset-password-quality.spec.ts",
        "email-verification-quality.spec.ts",
        "mfa-quality.spec.ts",
        "staff-admin.spec.ts",
      ],
      // Exercise the changed forms and invitation flow in the required matrix,
      // preserving the synthetic WebAuthn origin and all existing projects.
      use: { baseURL: "http://localhost:3103" },
      grep: /login fits|registration fits|recovery fits|reset link and manual entry fit|verification and resend fit|MFA methods and enrollment fit|security-key preparation|login accessibility|registration accessible|recovery accessibility|reset accessible|verification accessible|MFA challenge accessibility|anonymous invitation check|unavailable invitation session read|acceptance scrubs|acceptance handles|cross-tab account changes discard invitation/,
    },
    {
      name: "home-design",
      testMatch: ["home-design.spec.ts"],
    },
    {
      name: "workshop-navigation",
      testMatch: ["workshop-home.spec.ts"],
      grep: /workshop lift link reaches its photograph/,
    },
    {
      name: "viewport-navigation",
      testMatch: ["viewport-navigation.spec.ts"],
    },
    {
      name: "product-authoring",
      testMatch: ["work-products.spec.ts"],
      grep: /product estimates validate|edit stays locked|older catalogue/,
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
        "order-timing.spec.ts",
        "order-pickup.spec.ts",
        "order-supply-concerns.spec.ts",
        "booking-calendar.spec.ts",
        "booking-capacity.spec.ts",
        "invoice-modal-responsive.spec.ts",
        "modal-layout.spec.ts",
        "mfa-action-layout.spec.ts",
        "catalogue-modal-layout.spec.ts",
        "service-timing.spec.ts",
        "slot-timing-review.spec.ts",
        "customer-support-actions.spec.ts",
        "customer-overview-selection.spec.ts",
        "customer-overview-attention.spec.ts",
        "shared-shell-dock.spec.ts",
        "workforce-directory.spec.ts",
        "workforce-access-reviews.spec.ts",
        "work-staff-workforce.spec.ts",
        "workforce-care-policy.spec.ts",
        "work-staff-invitations.spec.ts",
        "access-history.spec.ts",
        "work-audit.spec.ts",
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
        "mfa-action-layout.spec.ts",
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
