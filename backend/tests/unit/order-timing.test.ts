import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  orderTimingBodySchema,
  orderTimingLineSchema,
} from "../../src/modules/orders/order-timing.schemas.js";
import { learningArticles } from "../../src/modules/learning/learning.content.js";

const line = () => ({
  orderItemId: randomUUID(),
  sourcingStatus: "UNKNOWN",
  sourcingFrom: null,
  sourcingUntil: null,
  preparationMinutes: null,
});
it("keeps unknown preparation separate from zero and accepts genuine supplier ranges", () => {
  expect(orderTimingLineSchema.parse(line()).preparationMinutes).toBeNull();
  expect(
    orderTimingLineSchema.parse({ ...line(), preparationMinutes: 0 }).preparationMinutes,
  ).toBe(0);
  expect(
    orderTimingLineSchema.safeParse({
      ...line(),
      sourcingStatus: "IN_TRANSIT",
      sourcingFrom: "2026-11-10T08:00:00+01:00",
      sourcingUntil: "2026-11-12T18:00:00+01:00",
    }).success,
  ).toBe(true);
});
it.each([
  { sourcingFrom: "2026-11-10T08:00:00+01:00" },
  {
    sourcingStatus: "ORDERED",
    sourcingFrom: "2026-11-12T08:00:00Z",
    sourcingUntil: "2026-11-10T08:00:00Z",
  },
  {
    sourcingStatus: "IN_STOCK",
    sourcingFrom: "2026-11-10T08:00:00Z",
    sourcingUntil: "2026-11-12T08:00:00Z",
  },
  { preparationMinutes: -1 },
  { preparationMinutes: 1.5 },
  { preparationMinutes: 525601 },
])("rejects invalid or misleading estimates %j", (invalid) => {
  expect(orderTimingLineSchema.safeParse({ ...line(), ...invalid }).success).toBe(false);
});
it("requires exact unique items, a fresh version, an idempotency key and separate bounded notes", () => {
  const item = line(),
    valid = {
      expectedVersion: 0,
      idempotencyKey: randomUUID(),
      lines: [item],
      customerNote: "Waiting for supplier",
      reason: "Supplier called today",
    };
  expect(orderTimingBodySchema.safeParse(valid).success).toBe(true);
  for (const change of [
    { lines: [item, item] },
    { expectedVersion: -1 },
    { reason: "" },
    { customerNote: "first\nsecond" },
    { customerNote: "x".repeat(1001) },
    { paidAt: "2026-11-10T00:00:00Z" },
  ])
    expect(orderTimingBodySchema.safeParse({ ...valid, ...change }).success).toBe(false);
});
it("keeps order-sourcing instructions admin-only without granting payment or collection authority", () => {
  const guide = learningArticles.find((article) => article.id === "order-sourcing")!;
  expect([guide.gate, guide.version]).toEqual(["admin", 11]);
  expect(guide.steps.join(" ")).toContain("cannot mark goods ready");
  expect(guide.steps.join(" ")).toContain("never enter a choice on their behalf");
});
