import { describe, expect, it } from "vitest";
import {
  orderMatchesFilters,
  parseWorkOrders,
  workOrdersQuery,
} from "@/lib/admin/work-orders";
import { workOrder, bookingId } from "../fixtures/work-orders";
describe("order discovery boundaries", () => {
  it("normalizes exact references without changing case and preserves bounded history", () => {
    const result = workOrdersQuery(
      new URLSearchParams({
        orderNumber: "  ORD-AbC  ",
        status: "READY",
        branchId: bookingId(101),
        customerId: bookingId(400),
        cursor: bookingId(2),
        _trail: `start,${bookingId(1)}`,
      }),
      true,
    );
    expect(result.invalid).toBe(false);
    expect(result.api.get("orderNumber")).toBe("ORD-AbC");
    expect(result.api.has("_trail")).toBe(false);
    expect(result.params.get("_trail")).toBe(`start,${bookingId(1)}`);
  });
  for (const input of [
    "status=PAID",
    "status=READY&status=PENDING",
    "customerId=no",
    "cursor=no",
    "orderNumber=a%00b",
    `orderNumber=${"a".repeat(121)}`,
    "branchId=no",
    "orderNumber=a&orderNumber=b",
  ])
    it(`blocks malformed query ${input.slice(0, 35)}`, () =>
      expect(workOrdersQuery(new URLSearchParams(input), true).path).toBeNull());
  it("does not expose branch filters to staff", () =>
    expect(
      workOrdersQuery(new URLSearchParams({ branchId: bookingId(101) }), false).path,
    ).toBeNull());
  it("ignores unusable navigation history without changing the API scope", () => {
    const result = workOrdersQuery(
      new URLSearchParams({
        cursor: bookingId(1),
        _trail: "arbitrary",
        tracking: "ignored",
      }),
      true,
    );
    expect(result.invalid).toBe(false);
    expect(result.params.has("_trail")).toBe(false);
    expect(result.api.has("tracking")).toBe(false);
  });
  it("rejects malformed, duplicate and oversized responses", () => {
    for (const value of [
      { items: [workOrder(), workOrder()] },
      { items: Array.from({ length: 26 }, (_, n) => workOrder(n)) },
      { items: [{ ...workOrder(), createdAt: "yesterday" }] },
      { items: [], nextCursor: "bad" },
    ])
      expect(() => parseWorkOrders(value)).toThrow();
  });
  it("checks filters and strips financial projection", () => {
    const page = parseWorkOrders({
      items: [{ ...workOrder(), invoice: { id: bookingId(8) } }],
    });
    expect(page.items[0]).not.toHaveProperty("invoice");
    expect(
      orderMatchesFilters(page.items[0], new URLSearchParams({ status: "READY" })),
    ).toBe(false);
    expect(
      orderMatchesFilters(
        page.items[0],
        new URLSearchParams({ orderNumber: page.items[0].orderNumber }),
      ),
    ).toBe(true);
    expect(
      orderMatchesFilters(
        page.items[0],
        new URLSearchParams({ branchId: bookingId(999) }),
      ),
    ).toBe(false);
  });
});
