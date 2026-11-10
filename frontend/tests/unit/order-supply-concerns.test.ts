import { describe, it, expect } from "vitest";
import {
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
