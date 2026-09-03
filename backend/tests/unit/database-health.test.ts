import { describe, expect, it, vi } from "vitest";

import { withTimeout } from "../../src/common/database/health.js";

describe("database readiness timeout", () => {
  it("resolves when the operation completes", async () => {
    await expect(withTimeout(async () => undefined, 100)).resolves.toBeUndefined();
  });

  it("rejects a stalled operation within the configured deadline", async () => {
    vi.useFakeTimers();
    const result = expect(
      withTimeout(() => new Promise<void>(() => undefined), 100),
    ).rejects.toThrow("Readiness check timed out");

    await vi.advanceTimersByTimeAsync(100);
    await result;
    vi.useRealTimers();
  });
});
