// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseCartAdd } from "@/app/components/purchase-cart-add";
import {
  purchaseCartSchema,
  readPurchaseCart,
  writePurchaseCart,
} from "@/lib/purchase/cart";

const capability = vi.hoisted(() => ({ checkoutEnabled: true }));
vi.mock("@/app/components/public-capabilities", () => ({
  usePublicCapabilities: () => capability,
}));
const productId = "ab000000-0000-4000-8000-000000000001";
beforeEach(() => {
  localStorage.clear();
  capability.checkoutEnabled = true;
});
afterEach(cleanup);

describe("account-optional browser cart", () => {
  it("stores only validated product IDs and quantities, replacing the selected quantity", () => {
    render(<PurchaseCartAdd productId={productId} available />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "3" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Add to cart" }).closest("form")!,
    );
    expect(readPurchaseCart()).toEqual([{ productId, quantity: 3 }]);
    expect(screen.getByRole("link", { name: "Review cart" }).getAttribute("href")).toBe(
      "/cart",
    );
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Add to cart" }).closest("form")!,
    );
    expect(readPurchaseCart()).toEqual([{ productId, quantity: 2 }]);
    expect(
      Object.keys(JSON.parse(localStorage.getItem("aat:purchase-cart:1")!)[0]),
    ).toEqual(["productId", "quantity"]);
  });
  it("refuses fractional quantities and disabled purchasing without changing storage", () => {
    const view = render(<PurchaseCartAdd productId={productId} available />);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1.5" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Add to cart" }).closest("form")!,
    );
    expect(readPurchaseCart()).toEqual([]);
    expect(screen.getByRole("alert").textContent).toContain("whole quantity");
    capability.checkoutEnabled = false;
    view.rerender(<PurchaseCartAdd productId={productId} available />);
    expect(
      (screen.getByRole("button", { name: "Add to cart" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.submit(
      screen.getByRole("button", { name: "Add to cart" }).closest("form")!,
    );
    expect(readPurchaseCart()).toEqual([]);
  });
  it("fails closed on duplicate identities, overposting and corrupt storage", () => {
    expect(
      purchaseCartSchema.safeParse([
        { productId, quantity: 1 },
        { productId: productId.toUpperCase(), quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(() =>
      writePurchaseCart([{ productId, quantity: 1, priceKobo: "1" } as never]),
    ).toThrow();
    localStorage.setItem("aat:purchase-cart:1", "not JSON");
    expect(() => readPurchaseCart()).toThrow();
  });
});
