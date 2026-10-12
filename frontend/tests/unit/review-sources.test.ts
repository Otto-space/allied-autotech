import { describe, expect, it } from "vitest";
import { reviewSources } from "@/lib/api/review-schemas";
import type { paths } from "@/lib/api/generated";

type SourcePage =
  paths["/customers/support/review-sources"]["get"]["responses"][200]["content"]["application/json"]["data"];
const id = "a1000000-0000-4000-8000-000000000001";
const productId = "a1000000-0000-4000-8000-000000000002";
describe("authoritative review source contract", () => {
  it("maps only allowed submission fields and derives a local eligibility lookup", () => {
    const page: SourcePage = {
      items: [
        {
          id,
          targetType: "PRODUCT",
          label: "Purchased part",
          productId,
          orderItemId: id,
        },
      ],
      nextCursor: id,
    };
    const result = reviewSources("PRODUCT", {
      ...page,
      items: page.items.map((row) => ({
        ...row,
        customerEmail: "private@example.test",
        path: "https://example.test",
      })),
    });
    expect(result).toEqual({
      items: [
        {
          id,
          label: "Purchased part",
          fields: { productId, orderItemId: id },
          path: `/customers/support/review-sources?targetType=PRODUCT&sourceId=${id}`,
        },
      ],
      nextCursor: id,
    });
  });
  it("fails closed on mismatched source identity, type and malformed pagination", () => {
    const item = { id, targetType: "ORDER", label: "Completed order", orderId: id };
    expect(() => reviewSources("SERVICE", { items: [item] })).toThrow();
    expect(() =>
      reviewSources("ORDER", { items: [{ ...item, orderId: productId }] }),
    ).toThrow();
    expect(() =>
      reviewSources("ORDER", { items: [item], nextCursor: "invalid" }),
    ).toThrow();
    expect(() => reviewSources("ORDER", { items: [{ id }] })).toThrow();
  });
  it("accepts an empty collection without inferring availability from history", () => {
    expect(reviewSources("SERVICE", { items: [] })).toEqual({ items: [] });
  });
});
