import { describe, expect, it } from "vitest";
import { customerPurchaseQuery } from "@/lib/customer-purchase-query";
import { parseCustomerPurchases } from "@/lib/api/customer-purchases-schema";
import { purchaseRecord, purchaseId } from "../fixtures/customer-purchases";

describe("customer purchase navigation boundary", () => {
  it("forwards only bounded supported API fields and keeps history client-side", () => {
    const query = customerPurchaseQuery(
      new URLSearchParams(
        `status=COMPLETED&limit=10&cursor=${purchaseId(4)}&_trail=start&customerId=${purchaseId(900)}&search=private`,
      ),
    );
    expect(query.path).toBe(
      `/customers/vehicle-transactions?status=COMPLETED&limit=10&cursor=${purchaseId(4)}`,
    );
    expect(query.params.get("_trail")).toBe("start");
  });
  it("rejects invalid filters and cursor history without blocking a safe first read", () => {
    const query = customerPurchaseQuery(
      new URLSearchParams("status=ADMIN&limit=1000&cursor=bad&_trail=bad"),
    );
    expect(query.invalid).toBe(true);
    expect(query.path).toBe("/customers/vehicle-transactions?limit=20");
    expect(query.params.has("_trail")).toBe(false);
  });
  it("bounds navigation history without inventing a page number", () => {
    const query = customerPurchaseQuery(
      new URLSearchParams(
        `cursor=${purchaseId(4)}&_trail=start,${Array(51).fill(purchaseId(3)).join(",")}`,
      ),
    );
    expect(query.params.has("cursor")).toBe(true);
    expect(query.params.has("_trail")).toBe(false);
  });
});

describe("customer purchase response boundary", () => {
  it("preserves exact string money and drops unrelated private fields", () => {
    const result = parseCustomerPurchases({
      items: [
        {
          ...purchaseRecord(),
          agreedPriceKobo: "9007199254740993",
          privateField: "hidden",
        },
      ],
    });
    expect(result.items[0].agreedPriceKobo).toBe("9007199254740993");
    expect(result.items[0]).not.toHaveProperty("privateField");
  });
  it.each([
    { status: "UNKNOWN" },
    { createdAt: "tomorrow" },
    { askingPriceKobo: 100 },
    { agreedPriceKobo: "-1" },
    { currency: "USD" },
  ])("rejects malformed records %j", (patch) => {
    expect(() =>
      parseCustomerPurchases({ items: [{ ...purchaseRecord(), ...patch }] }),
    ).toThrow();
  });
  it("rejects unsafe cursors, duplicate identities and unbounded pages", () => {
    expect(() =>
      parseCustomerPurchases({ items: [], nextCursor: "//elsewhere" }),
    ).toThrow();
    expect(() =>
      parseCustomerPurchases({ items: [purchaseRecord(), purchaseRecord()] }),
    ).toThrow();
    expect(() =>
      parseCustomerPurchases({
        items: Array.from({ length: 51 }, (_, n) => purchaseRecord(n + 1)),
      }),
    ).toThrow();
  });
});
