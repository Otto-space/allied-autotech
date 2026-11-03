import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../src/generated/prisma/client.js";
import {
  safePurchaseAvailability,
  purchaseOfferReviews,
} from "../../src/modules/orders/purchase-offer-view.js";
const id = (n: number) => `ef000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function snapshot(supplier = false) {
  return {
    version: 1,
    fitment: [
      {
        orderItemId: id(1),
        productId: id(2),
        quantity: 2,
        evidence: [
          {
            id: id(3),
            version: 0,
            sourceReference: "PRIVATE technical evidence",
            reviewedByUserId: id(4),
            reviewedAt: "2026-11-03T15:00:00Z",
          },
        ],
      },
    ],
    availability: [
      {
        orderItemId: id(1),
        evidence: supplier
          ? {
              kind: "SUPPLIER",
              sourceReference: "PRIVATE supplier confirmation",
              availableUntil: "2026-11-10T15:00:00Z",
              expectedFrom: "2026-11-05T07:00:00Z",
              expectedTo: "2026-11-07T17:00:00Z",
            }
          : {
              kind: "BRANCH_STOCK",
              inventoryId: id(5),
              reservationId: id(6),
              quantity: 2,
            },
      },
    ],
  };
}
describe("safe customer purchase offer", () => {
  it.each([false, true])(
    "shows only the supply source and genuine estimate (supplier=%s)",
    (supplier) => {
      const safe = safePurchaseAvailability(snapshot(supplier));
      expect(safe).toEqual([
        {
          orderItemId: id(1),
          kind: supplier ? "SUPPLIER" : "BRANCH_STOCK",
          ...(supplier
            ? { expectedFrom: "2026-11-05T07:00:00Z", expectedTo: "2026-11-07T17:00:00Z" }
            : {}),
        },
      ]);
      const text = JSON.stringify(safe);
      for (const hidden of [
        "PRIVATE",
        id(3),
        id(4),
        id(5),
        id(6),
        "sourceReference",
        "reviewedByUserId",
      ])
        expect(text).not.toContain(hidden);
    },
  );
  it.each([null, {}, { version: 2 }, { ...snapshot(true), availability: [] }])(
    "does not invent availability for incomplete proof",
    (proof) => {
      expect(safePurchaseAvailability(proof)).toEqual([]);
    },
  );
  it("queries exact approved review IDs and never exports the raw decision", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: id(20), decisionSnapshot: snapshot(true) }]);
    const database = {
      orderPurchaseReview: { findMany },
    } as unknown as Prisma.TransactionClient;
    const result = await purchaseOfferReviews(database, [
      { id: id(20), status: "APPROVED" },
      { id: id(21), status: "REQUESTED" },
    ]);
    expect(findMany.mock.calls[0][0].where).toEqual({
      id: { in: [id(20)] },
      status: "APPROVED",
    });
    expect(result[0].availability[0].kind).toBe("SUPPLIER");
    expect(result[1].availability).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("decisionSnapshot");
  });
  it("does not query private proof when no offer is approved", async () => {
    const findMany = vi.fn();
    await purchaseOfferReviews(
      { orderPurchaseReview: { findMany } } as unknown as Prisma.TransactionClient,
      [],
    );
    expect(findMany).not.toHaveBeenCalled();
  });
});
