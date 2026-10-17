import { describe, it, expect } from "vitest";
import {
  inventoryMatchesFilters,
  parseWorkInventories,
  workInventoryQuery,
} from "@/lib/admin/work-inventory";
import { stockRecord, bookingId } from "../fixtures/work-inventory";
describe("operational inventory contract", () => {
  it("validates complete nonnegative balances and unique branch/part records", () => {
    const row = stockRecord();
    expect(parseWorkInventories({ items: [row] }).items).toHaveLength(1);
    for (const value of [
      { ...row, available: 7 },
      { ...row, reserved: 11 },
      { ...row, updatedAt: "wrong" },
      { ...row, version: -1 },
    ])
      expect(() => parseWorkInventories({ items: [value] })).toThrow();
    expect(() =>
      parseWorkInventories({ items: [row, { ...row, id: bookingId(9999) }] }),
    ).toThrow();
  });
  it("builds encoded exact scope with only supported role filters", () => {
    const q = workInventoryQuery(
      new URLSearchParams({
        search: " Brake %_ ",
        lowStock: "true",
        branchId: bookingId(101),
        productId: bookingId(4100),
      }),
      true,
    );
    expect(q.invalid).toBe(false);
    expect(q.api.get("search")).toBe("Brake %_");
    expect(q.path).toContain("search=Brake+%25_");
    expect(workInventoryQuery(q.params, false).path).toBeNull();
  });
  it("rejects invalid duplicate filters and sanitizes cursor trail", () => {
    for (const raw of [
      "search=a&search=b",
      "lowStock=1",
      "productId=bad",
      "cursor=bad",
      "search=" + "x".repeat(101),
    ])
      expect(workInventoryQuery(new URLSearchParams(raw), true).invalid).toBe(true);
    expect(
      workInventoryQuery(
        new URLSearchParams({ cursor: bookingId(1), _trail: "bad" }),
        true,
      ).params.has("_trail"),
    ).toBe(false);
  });
  it("matches returned scope and low-stock equality without recomputing supplied balances", () => {
    expect(
      inventoryMatchesFilters(stockRecord(1), new URLSearchParams({ lowStock: "true" })),
    ).toBe(true);
    expect(
      inventoryMatchesFilters(stockRecord(), new URLSearchParams({ lowStock: "true" })),
    ).toBe(false);
    expect(
      inventoryMatchesFilters(
        stockRecord(),
        new URLSearchParams({ branchId: bookingId(102) }),
      ),
    ).toBe(false);
  });
});
