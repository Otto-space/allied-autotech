import { describe, expect, it } from "vitest";
import { stockRecord, bookingId } from "../fixtures/work-inventory";
import {
  parseWorkInventoryHistory,
  parseWorkInventoryReservations,
  validateInventoryResult,
  type InventoryProposal,
} from "@/lib/admin/work-inventory-detail";
const movement = {
  id: bookingId(5000),
  type: "STOCK_IN",
  quantityDelta: 3,
  reservedDelta: 0,
  quantityBefore: 10,
  quantityAfter: 13,
  reservedBefore: 2,
  reservedAfter: 2,
  referenceType: null,
  referenceId: null,
  note: null,
  createdAt: "2026-10-17T09:00:00.000Z",
  performedBy: null,
};
const proposal = (
  operation: InventoryProposal["operation"],
  input: Record<string, unknown>,
): InventoryProposal => ({
  operation,
  input,
  title: "Synthetic review",
  description: "Synthetic",
  facts: [],
  submit: async () => undefined,
});
describe("inventory detail verification", () => {
  it("checks receipt deltas, saved scope and consistent returned balances", () => {
    const original = stockRecord(),
      saved = { ...original, quantity: 13, available: 11 };
    const response = {
      data: { inventory: saved, transaction: movement, replayed: false },
    };
    expect(
      validateInventoryResult(
        response,
        proposal("movement", { type: "STOCK_IN", quantity: 3 }),
        original,
      ),
    ).toEqual(saved);
    for (const data of [
      { ...response.data, transaction: { ...movement, quantityDelta: 4 } },
      { ...response.data, inventory: { ...saved, id: bookingId(9999) } },
      { ...response.data, transaction: {} },
    ])
      expect(() =>
        validateInventoryResult(
          { data },
          proposal("movement", { type: "STOCK_IN", quantity: 3 }),
          original,
        ),
      ).toThrow();
  });
  it("allows a replay with subsequently changed balances while retaining the original receipt", () => {
    const original = stockRecord(),
      saved = { ...original, quantity: 20, available: 18 };
    expect(
      validateInventoryResult(
        { data: { inventory: saved, transaction: movement, replayed: true } },
        proposal("movement", { type: "STOCK_IN", quantity: 3 }),
        original,
      ),
    ).toEqual(saved);
  });
  it("requires the exact versioned reorder result without changing stock", () => {
    const original = stockRecord(),
      intent = proposal("reorder", { reorderLevel: 8, expectedVersion: 0 });
    expect(
      validateInventoryResult(
        { data: { ...original, version: 1, reorderLevel: 8 } },
        intent,
        original,
      ).version,
    ).toBe(1);
    expect(() =>
      validateInventoryResult(
        { data: { ...original, version: 2, reorderLevel: 8 } },
        intent,
        original,
      ),
    ).toThrow();
  });
  it("rejects duplicate or inconsistent history and malformed reservation dates", () => {
    expect(parseWorkInventoryHistory({ items: [movement] }).items).toHaveLength(1);
    expect(() => parseWorkInventoryHistory({ items: [movement, movement] })).toThrow();
    expect(() =>
      parseWorkInventoryHistory({ items: [{ ...movement, reservedAfter: 14 }] }),
    ).toThrow();
    expect(() =>
      parseWorkInventoryReservations({ items: [{ id: bookingId(1), quantity: 0 }] }),
    ).toThrow();
  });
});
