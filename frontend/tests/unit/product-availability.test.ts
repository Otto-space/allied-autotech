import { describe, expect, it } from "vitest";
import { productAvailability } from "@/lib/product-availability";

describe("published stock evidence", () => {
  it("does not turn an unlisted product into a zero-stock claim", () => {
    expect(productAvailability([])).toEqual({
      state: "unknown",
      label: "Availability not listed",
    });
  });
  it("qualifies the scope when every listed branch is unavailable", () => {
    expect(productAvailability([{ inStock: false }, { inStock: false }])).toEqual({
      state: "unavailable",
      label: "Unavailable at listed branches",
    });
  });
  it("retains availability when a different listed branch has stock", () => {
    expect(productAvailability([{ inStock: false }, { inStock: true }])).toEqual({
      state: "available",
      label: "In stock at a listed branch",
    });
  });
});
