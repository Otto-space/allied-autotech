import { describe, it, expect } from "vitest";
import {
  parseWorkVehicleStock,
  stockFilterDefaults,
  stockFilterParams,
  stockMatchesFilters,
  workVehicleStockQuery,
} from "@/lib/admin/work-vehicle-stock";
import { stockRecord, bookingId } from "../fixtures/work-vehicle-stock";
describe("vehicle stock discovery contract", () => {
  it("retains exact asking prices, zero mileage, unlisted records and historic branches", () => {
    const rows = [0, 2, 3].map(stockRecord);
    const page = parseWorkVehicleStock({ items: rows }, "ADMIN");
    expect(page.items[1].listings).toEqual([]);
    expect(page.items[1].branch.isActive).toBe(false);
    expect(page.items[2].mileageKm).toBe(0);
    expect(page.items[2].listings[0].priceKobo).toBe("9999999999999999");
  });
  it("rejects duplicated identities, invalid branches/prices and mismatched thumbnails", () => {
    const row = stockRecord();
    for (const value of [
      { ...row, branchId: bookingId(555) },
      { ...row, year: 0 },
      { ...row, listings: [{ ...row.listings[0], priceKobo: "1e9" }] },
      {
        ...row,
        images: [
          {
            ...row.images[0],
            url: `/api/v1/staff/vehicles/${bookingId(999)}/images/${row.images[0].id}/content`,
          },
        ],
      },
    ])
      expect(() => parseWorkVehicleStock({ items: [value] }, "ADMIN")).toThrow();
    expect(() => parseWorkVehicleStock({ items: [row, row] }, "ADMIN")).toThrow();
    expect(() =>
      parseWorkVehicleStock({ items: [row], nextCursor: bookingId(999) }, "ADMIN"),
    ).toThrow();
  });
  it("isolates Staff branch scope and refuses private acquisition fields", () => {
    const row = stockRecord();
    expect(() =>
      parseWorkVehicleStock({ items: [row] }, "STAFF", row.branchId),
    ).toThrow();
    const { acquisitionCostKobo: _cost, acquisitionCurrency: _currency, ...safe } = row;
    void _cost;
    void _currency;
    expect(
      parseWorkVehicleStock({ items: [safe] }, "STAFF", row.branchId).items,
    ).toHaveLength(1);
    expect(() =>
      parseWorkVehicleStock({ items: [safe] }, "STAFF", bookingId(999)),
    ).toThrow();
  });
  it("encodes literal queries, combines stable filters and retains cursor history", () => {
    const q = workVehicleStockQuery(
      new URLSearchParams({
        search: " %_\\ ",
        make: "Toyota",
        year: "2022",
        listed: "true",
        branchId: bookingId(101),
        cursor: bookingId(7002),
        _trail: "start",
      }),
      "ADMIN",
    );
    expect(q.invalid).toBe(false);
    expect(q.api.get("search")).toBe("%_\\");
    expect(q.path).toContain("search=%25_%5C");
    expect(q.params.get("_trail")).toBe("start");
    expect(stockMatchesFilters(stockRecord(), q.api)).toBe(true);
  });
  it("blocks invalid/repeated/unsupported links and Staff cross-branch filters", () => {
    for (const query of [
      "search=a&search=b",
      "year=2e3",
      "listed=false&status=AVAILABLE",
      "minPriceKobo=100",
      "branchId=bad",
      "status=OTHER",
      "cursor=bad",
    ])
      expect(workVehicleStockQuery(new URLSearchParams(query), "ADMIN").invalid).toBe(
        true,
      );
    expect(
      workVehicleStockQuery(
        new URLSearchParams({ branchId: bookingId(102) }),
        "STAFF",
        bookingId(101),
      ).invalid,
    ).toBe(true);
  });
  it("maps listed/unlisted form values without retaining stale cursors or hidden branch selection", () => {
    const values = stockFilterDefaults(
      new URLSearchParams({
        listed: "false",
        branchId: bookingId(102),
        cursor: bookingId(7000),
      }),
    );
    expect(values.status).toBe("UNLISTED");
    expect(stockFilterParams(values, true).toString()).toBe(
      `listed=false&branchId=${bookingId(102)}`,
    );
    expect(stockFilterParams(values, false).toString()).toBe("listed=false");
  });
});
