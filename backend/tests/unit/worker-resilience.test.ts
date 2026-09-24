import { describe, expect, it } from "vitest";

import { safeErrorAttributes } from "../../src/common/observability/safe-error.js";
import { identityWorkerBackoff } from "../../src/workers/outbox.worker.js";

describe("worker resilience", () => {
  it("uses bounded exponential backoff with bounded jitter", () => {
    expect(identityWorkerBackoff(1, () => 0)).toBe(1_000);
    expect(identityWorkerBackoff(2, () => 0.5)).toBe(2_250);
    expect(identityWorkerBackoff(20, () => 1)).toBe(30_500);
  });

  it("does not expose error messages, stacks, or unsafe codes", () => {
    const error = Object.assign(new Error("sensitive connection details"), {
      code: "ECONNREFUSED",
    });
    expect(safeErrorAttributes(error)).toEqual({
      errorName: "Error",
      errorCode: "ECONNREFUSED",
    });
    expect(JSON.stringify(safeErrorAttributes(error))).not.toContain("sensitive");
    expect(
      safeErrorAttributes({ name: "Error", code: "unsafe code with secret=value" }),
    ).toEqual({ errorName: "Error" });
  });

  it.each(["P2021", "P2022"])(
    "provides migration recovery guidance for %s without exposing database details",
    (code) => {
      const attributes = safeErrorAttributes({
        name: "PrismaClientKnownRequestError",
        code,
        message: "sensitive connection details",
        meta: { table: "private-schema-sensitive" },
      });
      expect(attributes.recoveryHint).toContain("npm run db:migrate");
      expect(attributes.errorCode).toBe(code);
      expect(JSON.stringify(attributes)).not.toContain("sensitive");
    },
  );
});
