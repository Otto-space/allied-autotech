import { describe, it, expect } from "vitest";
import {
  parseWorkVehicleSales,
  salesPageParams,
  workVehicleSalesQuery,
} from "@/lib/admin/work-vehicle-sales";
import { salesRecord, bookingId } from "../fixtures/work-vehicle-sales";
describe("workshop sales collection", () => {
  it("preserves exact money, nulls, timestamps and numeric references", () => {
    const row = parseWorkVehicleSales({ items: [salesRecord()] }, "ADMIN").items[0];
    expect(row.askingPriceKobo).toBe("9999999999999999");
    expect(row.agreedPriceKobo).toBeNull();
    expect(row.createdAt).toBe("2026-10-17T09:00:37.123Z");
    expect(row.vehicleListing.vehicle.images).toHaveLength(1);
    expect(row.vehicleListing.vehicle.images[0].isPrimary).toBe(true);
  });
  it("rejects duplicates, invalid dates/money, foreign scope and mismatched filters", () => {
    const row = salesRecord();
    for (const items of [
      [row, row],
      [{ ...row, createdAt: "bad" }],
      [{ ...row, version: -1 }],
      [{ ...row, askingPriceKobo: 9999999999999999 }],
      [{ ...row, agreedPriceKobo: "1.5" }],
    ])
      expect(() => parseWorkVehicleSales({ items }, "ADMIN")).toThrow();
    expect(() =>
      parseWorkVehicleSales({ items: [row] }, "STAFF", bookingId(103)),
    ).toThrow();
    expect(() => parseWorkVehicleSales({ items: [row] }, "STAFF", null)).toThrow();
    expect(() =>
      parseWorkVehicleSales(
        { items: [row] },
        "ADMIN",
        undefined,
        new URLSearchParams("status=PAID"),
      ),
    ).toThrow();
  });
  it("validates handover evidence without confusing zero with null", () => {
    const row = salesRecord(2),
      parsed = parseWorkVehicleSales({ items: [row] }, "ADMIN").items[0];
    expect(parsed.handover?.odometerKm).toBe(0);
    expect(parsed.handover?.keysDelivered).toBe(0);
    expect(() =>
      parseWorkVehicleSales(
        { items: [{ ...row, handover: { ...row.handover, readyAt: "bad" } }] },
        "ADMIN",
      ),
    ).toThrow();
  });
  it("reuses status/cursor contracts and refuses unsupported or foreign links", () => {
    const query = workVehicleSalesQuery(
      new URLSearchParams(`status=NEGOTIATING&branchId=${bookingId(101)}`),
      "STAFF",
      bookingId(101),
    );
    expect(query.path).toContain("/staff/vehicle-transactions?");
    expect(query.api.get("limit")).toBe("25");
    for (const text of [
      "status=bad",
      "status=PAID&status=PAID",
      "search=Toyota",
      "cursor=bad",
      `branchId=${bookingId(103)}`,
    ])
      expect(
        workVehicleSalesQuery(new URLSearchParams(text), "STAFF", bookingId(101)).path,
      ).toBeNull();
    const next = salesPageParams(query.params, bookingId(10024));
    expect(next.get("_trail")).toBe("start");
    expect(salesPageParams(next, undefined, true).toString()).toBe(
      query.params.toString(),
    );
    expect(workVehicleSalesQuery(next, "ADMIN").api.has("_trail")).toBe(false);
  });
});
