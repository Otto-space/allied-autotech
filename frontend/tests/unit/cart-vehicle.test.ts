// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cartVehicleFromSearch } from "@/lib/purchase/cart-vehicle";
import { cartLineMatchesOrder } from "@/lib/purchase/cart-receipt";
import { parseOrder } from "@/lib/api/commerce-schemas";
import { orderRecord } from "../fixtures/customer-orders";
import {
  readPurchaseCart,
  setPurchaseCartItem,
  writePurchaseCart,
} from "@/lib/purchase/cart";
const id = (n: number) => `f1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const choice = {
  vehicleModelId: id(1),
  year: 2026,
  position: "front",
  engineCode: "Synthetic engine",
};
afterEach(() => localStorage.clear());
describe("cart vehicle carry-through", () => {
  it("preserves a changed or cleared vehicle choice when recovering an older saved order", () => {
    const order = parseOrder(orderRecord(3)),
      item = order.items[0],
      selected = order.purchaseReviews[0].requirements.lines[0].selection!;
    const row = {
      productId: item.productId,
      quantity: item.quantity,
      vehicleSelection: selected,
    };
    expect(cartLineMatchesOrder(order, row)).toBe(true);
    expect(
      cartLineMatchesOrder(order, {
        ...row,
        vehicleSelection: { ...selected, year: 2027 },
      }),
    ).toBe(false);
    expect(cartLineMatchesOrder(order, { ...row, vehicleSelection: null })).toBe(false);
    expect(cartLineMatchesOrder(order, { ...row, quantity: item.quantity + 1 })).toBe(
      false,
    );
  });
  it("carries only the explicit configuration, never a client compatibility or price claim", () => {
    const query = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(choice).map(([key, value]) => [key, String(value)]),
      ),
      fitment: "VERIFIED_FIT",
      priceKobo: "1",
      stock: "999",
      approved: "true",
    });
    expect(cartVehicleFromSearch(query)).toEqual(choice);
    expect(
      cartVehicleFromSearch(new URLSearchParams("fitment=VERIFIED_FIT&year=2026")),
    ).toBeNull();
  });
  it.each(["", "tomorrow", "1800", "2026.5", "2201"])(
    "does not fabricate a valid selection from year %s",
    (year) => {
      expect(
        cartVehicleFromSearch(new URLSearchParams({ vehicleModelId: id(1), year })),
      ).toBeNull();
    },
  );
  it("preserves the chosen vehicle for quantity edits and replaces it on an explicit new choice", () => {
    setPurchaseCartItem(id(2), 2, choice);
    writePurchaseCart(readPurchaseCart().map((line) => ({ ...line, quantity: 3 })));
    expect(readPurchaseCart()).toEqual([
      { productId: id(2), quantity: 3, vehicleSelection: choice },
    ]);
    setPurchaseCartItem(id(2), 1, { ...choice, year: 2027 });
    expect(readPurchaseCart()[0].vehicleSelection?.year).toBe(2027);
    setPurchaseCartItem(id(2), 1, null);
    expect(readPurchaseCart()[0].vehicleSelection).toBeNull();
  });
  it("continues to read an existing quantity-only cart without adding invented vehicle details", () => {
    writePurchaseCart([{ productId: id(2), quantity: 2 }]);
    expect(readPurchaseCart()).toEqual([{ productId: id(2), quantity: 2 }]);
  });
});
