import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeJobCursor,
  encodeJobCursor,
  jobCursorBinding,
} from "../../src/modules/audit/operational-job-cursor.js";
describe("Operational job cursors", () => {
  it("binds filters and account but keeps the original row boundary", () => {
    const user = randomUUID(),
      binding = jobCursorBinding(user, { source: "OUTBOX", status: "FAILED" });
    const position = {
      source: "OUTBOX" as const,
      id: randomUUID(),
      updatedAt: "2026-10-12T12:00:00.001Z",
    };
    const cursor = encodeJobCursor(binding, position);
    expect(decodeJobCursor(binding, cursor)).toEqual(position);
    for (const wrong of [
      jobCursorBinding(randomUUID(), { source: "OUTBOX", status: "FAILED" }),
      jobCursorBinding(user, {}),
      jobCursorBinding(user, { source: "PAYMENT_WEBHOOK", status: "FAILED" }),
    ])
      expect(() => decodeJobCursor(wrong, cursor)).toThrow();
  });
  it("rejects altered, truncated, oversized and legacy identifiers", () => {
    const binding = jobCursorBinding(randomUUID(), {}),
      cursor = encodeJobCursor(binding, {
        source: "PAYMENT_WEBHOOK",
        id: randomUUID(),
        updatedAt: new Date().toISOString(),
      });
    for (const invalid of [
      randomUUID(),
      cursor.slice(1),
      cursor.slice(0, -1) + (cursor.endsWith("0") ? "1" : "0"),
      "x".repeat(1025),
    ])
      expect(() => decodeJobCursor(binding, invalid)).toThrow();
  });
});
