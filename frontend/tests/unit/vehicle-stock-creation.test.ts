// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  clearStockCreation,
  confirmStockCreation,
  markStockCreation,
  parseCreatedStock,
  readStockCreation,
  redactStockCreations,
  stockCreationDraft,
  stockCreationStorageKey,
} from "@/lib/admin/vehicle-stock-creation";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  recordSchema,
  vehicleDefaults,
  vehicleRecordBody,
} from "@/lib/forms/vehicle-record";
import { stockRecord, bookingId } from "../fixtures/work-vehicle-stock";
const owner = bookingId(302),
  branch = bookingId(101),
  role = "ADMIN";
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  setDraftIdentity(null);
});
describe("stock creation safety and projection", () => {
  it("preserves zero mileage, all optional values, exact cost and Lagos acquisition time", () => {
    const values = recordSchema.parse({
      ...vehicleDefaults(undefined, branch),
      stockNumber: "new-01",
      make: "Toyota",
      model: "Camry",
      year: "2022",
      mileageKm: "0",
      acquisitionPrice: "99999999999999.99",
      acquiredAt: "2026-10-17T10:00",
    });
    const body = {
        ...vehicleRecordBody(values),
        branchId: branch,
        stockNumber: values.stockNumber.toUpperCase(),
      },
      row = {
        ...stockRecord(),
        ...body,
        listings: [],
        images: [],
        conditionReports: [],
        documents: [],
        acquiredAt: "2026-10-17T09:00:00.000Z",
      };
    expect(body.acquisitionCostKobo).toBe("9999999999999999");
    expect(body.mileageKm).toBe(0);
    expect(parseCreatedStock(row, body, role).id).toBe(row.id);
  });
  it("rejects mismatched results, populated new records and Staff acquisition leaks", () => {
    const values = recordSchema.parse({
        ...vehicleDefaults(undefined, branch),
        stockNumber: "NEW-02",
        make: "Toyota",
        model: "Camry",
        year: "2022",
      }),
      body = {
        ...vehicleRecordBody(values),
        branchId: branch,
        stockNumber: values.stockNumber,
      },
      row = {
        ...stockRecord(),
        ...body,
        listings: [],
        images: [],
        conditionReports: [],
        documents: [],
      };
    for (const bad of [
      { ...row, stockNumber: "OTHER" },
      { ...row, version: 1 },
      { ...row, branchId: bookingId(102) },
      { ...row, listings: stockRecord().listings },
      { ...row, images: stockRecord().images },
      { ...row, acquisitionCostKobo: "1" },
    ])
      expect(() => parseCreatedStock(bad, body, role)).toThrow();
    const staffBody = {
      ...vehicleRecordBody(values, false),
      branchId: branch,
      stockNumber: values.stockNumber,
    };
    expect(() => parseCreatedStock(row, staffBody, "STAFF")).toThrow();
    const { acquisitionCostKobo: _cost, acquisitionCurrency: _currency, ...safe } = row;
    void _cost;
    void _currency;
    expect(parseCreatedStock(safe, staffBody, "STAFF").id).toBe(row.id);
  });
  it("keeps pending state across reads and only confirms or clears its own request token", () => {
    const pending = markStockCreation(owner, role, "NEW-03", branch);
    expect(readStockCreation(owner, role)).toEqual(pending);
    expect(() => markStockCreation(owner, role, "NEW-04", branch)).toThrow();
    expect(() => clearStockCreation(owner, role, bookingId(999))).toThrow();
    expect(readStockCreation(owner, role)).toEqual(pending);
    const confirmed = confirmStockCreation(owner, role, pending, bookingId(9000));
    expect(confirmed).toEqual({
      kind: "confirmed",
      token: pending.token,
      vehicleId: bookingId(9000),
    });
    clearStockCreation(owner, role, pending.token);
    expect(readStockCreation(owner, role)).toBeUndefined();
  });
  it("isolates actors and branch drafts; logout redacts metadata while retaining a lock", () => {
    markStockCreation(owner, role, "PRIVATE-STOCK", branch);
    expect(readStockCreation(bookingId(999), role)).toBeUndefined();
    expect(stockCreationDraft(branch)).not.toBe(stockCreationDraft(bookingId(102)));
    setDraftIdentity(`${bookingId(999)}:${role}`);
    expect(() => clearStockCreation(owner, role)).toThrow();
    redactStockCreations();
    expect(readStockCreation(owner, role)).toBe("unknown");
    expect(sessionStorage.getItem(stockCreationStorageKey(owner, role))).not.toContain(
      "PRIVATE-STOCK",
    );
  });
  it("fails closed on corrupt or unavailable recovery storage and failed writes", () => {
    sessionStorage.setItem(stockCreationStorageKey(owner, role), "bad");
    expect(readStockCreation(owner, role)).toBe("unknown");
    expect(() => markStockCreation(owner, role, "NEW-05", branch)).toThrow();
    sessionStorage.clear();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Storage disabled");
    });
    expect(() => markStockCreation(owner, role, "NEW-05", branch)).toThrow();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("Storage disabled");
    });
    expect(readStockCreation(owner, role)).toBe("unknown");
  });
  it("rejects impossible calendar dates and uppercase stock numbers exceeding backend bounds", () => {
    const base = {
      ...vehicleDefaults(undefined, branch),
      stockNumber: "NEW-06",
      make: "Toyota",
      model: "Camry",
      year: "2022",
    };
    expect(
      recordSchema.safeParse({ ...base, acquiredAt: "2026-02-30T10:00" }).success,
    ).toBe(false);
    expect(
      recordSchema.safeParse({ ...base, acquiredAt: "2024-02-29T10:00" }).success,
    ).toBe(true);
    expect(recordSchema.safeParse({ ...base, stockNumber: "ß".repeat(25) }).success).toBe(
      false,
    );
  });
});
