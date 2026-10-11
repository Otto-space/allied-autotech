import { describe, expect, it } from "vitest";
import { parseCartUpdate } from "@/lib/api/cart-update";
import { product, id } from "../fixtures/public-account-actions";
const receipt = () => ({
  subtotalKobo: "2500000",
  items: [
    {
      id: id(71),
      product: { ...product, priceKobo: "1250000" },
      quantity: 2,
      unitPriceKobo: "1250000",
      lineSubtotalKobo: "2500000",
    },
  ],
});
describe("cart update confirmation", () => {
  it("accepts the exact requested replacement quantity and reconciled amounts", () =>
    expect(parseCartUpdate(receipt(), product.id, 2).subtotalKobo).toBe("2500000"));
  it("preserves integer-kobo values above Number precision", () => {
    const r = receipt();
    r.items[0].unitPriceKobo = "9007199254740993";
    r.items[0].lineSubtotalKobo = "18014398509481986";
    r.subtotalKobo = r.items[0].lineSubtotalKobo;
    expect(parseCartUpdate(r, product.id, 2).subtotalKobo).toBe(r.subtotalKobo);
  });
  it.each([0, -1, 1.5, 1001, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid quantity %s",
    (quantity) => {
      const r = receipt();
      r.items[0].quantity = quantity;
      expect(() => parseCartUpdate(r, product.id, quantity)).toThrow();
    },
  );
  it.each(["line", "subtotal", "product", "row", "target", "quantity"])(
    "rejects an inconsistent %s receipt",
    (kind) => {
      const r = receipt();
      if (kind === "line") r.items[0].lineSubtotalKobo = "1";
      if (kind === "subtotal") r.subtotalKobo = "1";
      if (kind === "product") r.items.push({ ...r.items[0], id: id(72) });
      if (kind === "row")
        r.items.push({ ...r.items[0], product: { ...product, id: id(72) } });
      expect(() =>
        parseCartUpdate(
          r,
          kind === "target" ? id(99) : product.id,
          kind === "quantity" ? 3 : 2,
        ),
      ).toThrow();
    },
  );
});
