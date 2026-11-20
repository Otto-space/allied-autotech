import { defineConfig } from "@playwright/test";
import runtime from "./playwright.runtime.config";

// Exercise the existing production build with synthetic account/provider APIs.
// Keep this focused campaign separate from the existing runtime matrix so its
// evidence and timeout budget are retained without running these cases twice.
export default defineConfig({
  ...runtime,
  projects: [
    {
      name: "allie-care",
      testMatch: [
        "allie-conversation.spec.ts",
        "allie-handoff.spec.ts",
        "allie-privacy-wording.spec.ts",
        "support-channel.spec.ts",
        "support-coverage.spec.ts",
      ],
      use: { browserName: "chromium" },
    },
  ],
  outputDir: "./test-results/allie-care",
  reporter: [
    ["list"],
    ["json", { outputFile: "./test-results/allie-care/results.json" }],
  ],
});
