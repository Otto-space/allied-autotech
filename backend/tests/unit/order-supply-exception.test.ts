import { describe, it, expect } from "vitest";
import { createOrderMoneyAllocation } from "../../src/modules/orders/order-money-allocation.js";
import {
  affectedUnitRangesSchema,
  assertNoSupplyOverlap,
  assertSupplyExceptionRanges,
  supplyExceptionMoneyBasis,
  uncoveredSupplyRanges,
} from "../../src/modules/orders/order-supply-exception.engine.js";
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const item = { id, quantity: 3, unitPriceKobo: 101n, subtotalKobo: 303n };
const allocation = createOrderMoneyAllocation([item], 5n, 22n);
const order = {
  policySnapshot: { monetaryAllocation: allocation },
  items: [item],
  subtotalKobo: 303n,
  discountAmountKobo: 5n,
  taxKobo: 22n,
  totalKobo: 320n,
  deliveryFeeKobo: 0n,
};
describe("bounded supply concern evidence", () => {
  it("uses saved gross and tax portions exactly across disjoint quantities without a deduction", () => {
    const parts = [0, 1, 2].map((offset) =>
      supplyExceptionMoneyBasis(order, [{ orderItemId: id, offset, quantity: 1 }]),
    );
    expect(parts.map((part) => part.feeKobo)).toEqual(["0", "0", "0"]);
    expect(parts.reduce((sum, part) => sum + BigInt(part.amounts!.totalKobo), 0n)).toBe(
      320n,
    );
    expect(parts.reduce((sum, part) => sum + BigInt(part.amounts!.taxKobo), 0n)).toBe(
      22n,
    );
    expect(
      parts.reduce((sum, part) => sum + BigInt(part.amounts!.discountKobo), 0n),
    ).toBe(5n);
  });
  it("does not reprice a historical order or infer attributable delivery charges", () => {
    expect(
      supplyExceptionMoneyBasis({ ...order, policySnapshot: {} }, [
        { orderItemId: id, offset: 0, quantity: 1 },
      ]),
    ).toMatchObject({ status: "HISTORICAL_BREAKDOWN_REVIEW_REQUIRED", amounts: null });
    expect(
      supplyExceptionMoneyBasis({ ...order, totalKobo: 370n, deliveryFeeKobo: 50n }, [
        { orderItemId: id, offset: 0, quantity: 1 },
      ]).status,
    ).toBe("ATTRIBUTABLE_CHARGES_REVIEW_REQUIRED");
    expect(() =>
      supplyExceptionMoneyBasis({ ...order, totalKobo: 999n }, [
        { orderItemId: id, offset: 0, quantity: 1 },
      ]),
    ).toThrow();
  });
  it("refuses duplicate, overlapping, foreign and over-sized goods without allocating money", () => {
    expect(
      affectedUnitRangesSchema.safeParse([
        { orderItemId: id, offset: 0, quantity: 2 },
        { orderItemId: id, offset: 1, quantity: 1 },
      ]).success,
    ).toBe(false);
    expect(() =>
      assertSupplyExceptionRanges(
        [item],
        [{ orderItemId: other, offset: 0, quantity: 1 }],
      ),
    ).toThrow();
    expect(() =>
      assertSupplyExceptionRanges([item], [{ orderItemId: id, offset: 2, quantity: 2 }]),
    ).toThrow();
    expect(() =>
      assertNoSupplyOverlap(
        [{ orderItemId: id, offset: 0, quantity: 2 }],
        [{ orderItemId: id, offset: 1, quantity: 1 }],
      ),
    ).toThrow();
    expect(() =>
      assertNoSupplyOverlap(
        [{ orderItemId: id, offset: 0, quantity: 1 }],
        [{ orderItemId: id, offset: 1, quantity: 1 }],
      ),
    ).not.toThrow();
  });
  it("subtracts collected and already-reviewed ranges without duplicating an alert", () => {
    expect(
      uncoveredSupplyRanges({ id, quantity: 100000 }, 2, [
        { orderItemId: id, offset: 4, quantity: 2 },
        { orderItemId: id, offset: 8, quantity: 99992 },
      ]),
    ).toEqual([
      { orderItemId: id, offset: 2, quantity: 2 },
      { orderItemId: id, offset: 6, quantity: 2 },
    ]);
    expect(
      uncoveredSupplyRanges(item, 0, [{ orderItemId: id, offset: 0, quantity: 3 }]),
    ).toEqual([]);
    expect(() => uncoveredSupplyRanges(item, 4, [])).toThrow();
  });
});

it("rejects invented financial outcomes and unconfirmed substitute acceptance at customer choice", async () => {
  const { supplyRemedyChoiceSchema } =
    await import("../../src/modules/orders/order-supply-exception.schemas.js");
  const body = {
    expectedVersion: 1,
    idempotencyKey: "00000000-0000-4000-8000-000000000001",
    supplyExceptionId: "00000000-0000-4000-8000-000000000002",
    choice: "REFUND_REVIEW",
    statementVersion: "SUPPLY_CHOICE_20261110_V1",
    choiceConfirmed: true,
  };
  expect(supplyRemedyChoiceSchema.safeParse(body).success).toBe(true);
  for (const change of [
    { choiceConfirmed: false },
    { statementVersion: "unreviewed" },
    { choice: "ALTERNATIVE_ACCEPTED" },
    { refundApproved: true },
    { amountKobo: "100" },
    { customerUserId: body.idempotencyKey },
    { customerNote: "first\nsecond" },
  ])
    expect(supplyRemedyChoiceSchema.safeParse({ ...body, ...change }).success).toBe(
      false,
    );
});
