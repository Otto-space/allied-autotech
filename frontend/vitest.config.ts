import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    // Bound memory use on CI runners and machines with many logical CPUs.
    maxWorkers: 2,
    include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
    restoreMocks: true,
  },
});
