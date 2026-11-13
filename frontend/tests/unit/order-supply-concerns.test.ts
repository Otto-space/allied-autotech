import { describe, it, expect } from "vitest";
import {
  canReviewSupplyResolution,
  parseSupplySummary,
  selectedSupplyRanges,
  remainingSupplyRefundAmount,
  supplyChoiceLocked,
} from "../../lib/order-supply-concerns";
import {
  supplyOrder,
  supplySummary,
  supplyId,
  supplyChoiceRecord,
} from "../fixtures/order-supply-concerns";
describe("actual owned supply concern projection", () => {
  it("rejects a saved disposition that duplicates, omits or reassigns affected units", () => {
    const order = supplyOrder(),
      data = supplySummary(order);
    data.orderVersion = 2;
    const resolution = {
      id: supplyId(82),
      orderVersion: 1,
      createdAt: "2026-11-10T11:00:00Z",
      unfulfilledLines: data.items[0].affectedLines,
      previouslyHandedLines: [],
    };
    data.items[0].resolution = resolution;
    expect(parseSupplySummary(data, order).items[0].resolution?.id).toBe(resolution.id);
    for (const change of [
      { unfulfilledLines: [] },
      { previouslyHandedLines: data.items[0].affectedLines },
      { unfulfilledLines: [{ ...data.items[0].affectedLines[0], offset: 1 }] },
      { orderVersion: 2 },
    ]) {
      data.items[0].resolution = { ...resolution, ...change };
      expect(() => parseSupplySummary(data, order)).toThrow();
    }
  });
  it("offers reconciliation review only for a complete exact successful original refund", () => {
    const row = supplySummary().items[0],
      current = supplyChoiceRecord();
    row.supplyRemedyChoices = [current];
    const refund = {
      id: supplyId(81),
      amountKobo: "107",
      currency: "NGN" as const,
      status: "SUCCEEDED" as const,
      requestedAt: "2026-11-10T08:00:00Z",
      processedAt: "2026-11-10T10:00:00Z",
    };
    expect(canReviewSupplyResolution(row)).toBe(false);
    current.refunds = [refund];
    expect(canReviewSupplyResolution(row)).toBe(true);
    for (const change of [
      { status: "PROCESSING" as const },
      { processedAt: null },
      { amountKobo: "106" },
    ]) {
      current.refunds = [{ ...refund, ...change }];
      expect(canReviewSupplyResolution(row)).toBe(false);
    }
    current.refunds = [refund];
    current.hasMoreRefunds = true;
    expect(canReviewSupplyResolution(row)).toBe(false);
    current.hasMoreRefunds = false;
    row.resolution = {
      id: supplyId(82),
      orderVersion: 2,
      createdAt: "2026-11-10T11:00:00Z",
      unfulfilledLines: row.affectedLines,
      previouslyHandedLines: [],
    };
    expect(canReviewSupplyResolution(row)).toBe(false);
  });
  it("keeps offered alternatives distinct from actual acceptance and a cancelled replacement", () => {
    const row = supplySummary().items[0];
    const selected = {
      ...supplyChoiceRecord(),
      choice: "SUITABLE_ALTERNATIVE_REVIEW" as const,
    };
    selected.alternatives = [
      {
        id: supplyId(50),
        status: "ISSUED",
        productName: "Synthetic suitable offer",
        quantity: 2,
        totalKobo: "430",
        currency: "NGN",
        expiresAt: "2026-11-17T09:00:00Z",
        orderId: null,
        orderStatus: null,
      },
    ];
    row.supplyRemedyChoices = [selected];
    expect(supplyChoiceLocked(row)).toBe(false);
    selected.alternatives[0] = {
      ...selected.alternatives[0],
      status: "ACCEPTED",
      orderId: supplyId(51),
      orderStatus: "PENDING",
    };
    expect(supplyChoiceLocked(row)).toBe(true);
    expect(remainingSupplyRefundAmount(row)).toBe("107");
    selected.alternatives[0].orderStatus = "CANCELLED";
    expect(supplyChoiceLocked(row)).toBe(false);
    selected.hasMoreAlternatives = true;
    expect(supplyChoiceLocked(row)).toBe(true);
  });
  it("binds the order and every affected range, refusing foreign/malformed or duplicate cases", () => {
    const order = supplyOrder(),
      data = supplySummary(order);
    expect(parseSupplySummary(data, order).orderId).toBe(order.id);
    for (const change of [
      { orderId: supplyId(90) },
      { items: [...data.items, ...data.items] },
      {
        items: [
          {
            ...data.items[0],
            affectedLines: [{ orderItemId: supplyId(99), offset: 0, quantity: 1 }],
          },
        ],
      },
      {
        items: [
          {
            ...data.items[0],
            affectedLines: [{ orderItemId: order.items[0].id, offset: 2, quantity: 2 }],
          },
        ],
      },
      { choiceStatementVersion: "unapproved" },
    ])
      expect(() => parseSupplySummary({ ...data, ...change }, order)).toThrow();
  });
  it("selects only real checked original units and preserves their exact positions", () => {
    const order = supplyOrder(),
      form = new FormData();
    expect(() => selectedSupplyRanges(form, order.items)).toThrow();
    form.set("affected", order.items[0].id);
    form.set(`${order.items[0].id}-first`, "2");
    form.set(`${order.items[0].id}-quantity`, "2");
    expect(selectedSupplyRanges(form, order.items)).toEqual([
      { orderItemId: order.items[0].id, offset: 1, quantity: 2 },
    ]);
    form.set(`${order.items[0].id}-quantity`, "3");
    expect(() => selectedSupplyRanges(form, order.items)).toThrow();
  });
  it("counts commitments with bigint and never treats failed/cancelled requests as money returned", () => {
    const row = supplySummary().items[0];
    row.supplyRemedyChoices = [supplyChoiceRecord()];
    const refund = {
      id: supplyId(7),
      amountKobo: "50",
      currency: "NGN" as const,
      status: "REQUESTED" as const,
      requestedAt: "2026-11-10T09:00:00Z",
      processedAt: null,
    };
    row.supplyRemedyChoices[0].refunds = [
      refund,
      { ...refund, id: supplyId(8), amountKobo: "20", status: "FAILED" },
      { ...refund, id: supplyId(9), amountKobo: "10", status: "CANCELLED" },
    ];
    expect(remainingSupplyRefundAmount(row)).toBe("57");
    expect(supplyChoiceLocked(row)).toBe(true);
    row.supplyRemedyChoices[0].refunds = [{ ...refund, amountKobo: "108" }];
    expect(remainingSupplyRefundAmount(row)).toBeNull();
    row.supplyRemedyChoices[0].refunds = [{ ...refund, status: "CANCELLED" }];
    expect(supplyChoiceLocked(row)).toBe(false);
  });
  it("fails closed for incomplete history or unresolved legacy charges and keeps bank/actor details out of the parsed refund view", () => {
    const order = supplyOrder(),
      data = supplySummary(order),
      row = data.items[0];
    row.hasMoreChoices = true;
    expect(remainingSupplyRefundAmount(row)).toBeNull();
    expect(supplyChoiceLocked(row)).toBe(true);
    row.hasMoreChoices = false;
    row.monetaryBasis.status = "ATTRIBUTABLE_CHARGES_REVIEW_REQUIRED";
    expect(remainingSupplyRefundAmount(row)).toBeNull();
    row.supplyRemedyChoices = [
      {
        ...supplyChoiceRecord(),
        refunds: [
          {
            id: supplyId(7),
            amountKobo: "50",
            currency: "NGN",
            status: "NEEDS_ATTENTION",
            requestedAt: "2026-11-10T09:00:00Z",
            processedAt: null,
            ...{ bankReference: "private-bank-proof", requestedByUserId: supplyId(88) },
          },
        ],
      },
    ];
    expect(JSON.stringify(parseSupplySummary(data, order))).not.toContain(
      "private-bank-proof",
    );
    expect(JSON.stringify(parseSupplySummary(data, order))).not.toContain(
      "requestedByUserId",
    );
  });
});
