import { describe, expect, it } from "vitest";
import { timingUpdatesSchema, timingSignature } from "@/lib/order-timing";
import { parseStaffOrderDetail } from "@/lib/admin/work-order-detail";
import { staffOrderRecord, bookingId } from "../fixtures/work-order-detail";

describe("order sourcing receipt validation", () => {
  const line = {
    orderItemId: bookingId(1200),
    sourcingStatus: "IN_TRANSIT" as const,
    sourcingFrom: "2026-11-10T08:00:00Z",
    sourcingUntil: "2026-11-12T18:00:00Z",
    preparationMinutes: 0,
  };
  const update = {
    id: bookingId(9200),
    orderVersion: 0,
    lines: [line],
    customerNote: "Supplier confirmed transit",
    createdAt: "2026-11-09T12:00:00Z",
  };
  it("parses a saved update and keeps unknown distinct from zero", () => {
    expect(timingUpdatesSchema.parse([update])![0].lines[0].preparationMinutes).toBe(0);
    expect(
      timingUpdatesSchema.parse([
        { ...update, lines: [{ ...line, preparationMinutes: null }] },
      ])![0].lines[0].preparationMinutes,
    ).toBeNull();
    expect(parseStaffOrderDetail(staffOrderRecord()).timingUpdates).toBeUndefined();
  });
  it.each([
    { sourcingUntil: null },
    { sourcingUntil: "2026-11-09T00:00:00Z" },
    { preparationMinutes: 1.5 },
    { sourcingStatus: "GUARANTEED" },
  ])("rejects misleading or malformed estimates %j", (invalid) => {
    expect(
      timingUpdatesSchema.safeParse([{ ...update, lines: [{ ...line, ...invalid }] }])
        .success,
    ).toBe(false);
  });
  it("normalises JSONB key order while binding every estimate field", () => {
    const reordered = {
      preparationMinutes: 0,
      sourcingUntil: line.sourcingUntil,
      sourcingFrom: line.sourcingFrom,
      sourcingStatus: line.sourcingStatus,
      orderItemId: line.orderItemId,
    };
    expect(timingSignature([line])).toBe(timingSignature([reordered]));
    for (const change of [
      { preparationMinutes: null },
      { orderItemId: bookingId(9999) },
      { sourcingUntil: "2026-11-13T00:00:00Z" },
    ])
      expect(timingSignature([line])).not.toBe(timingSignature([{ ...line, ...change }]));
  });
});
