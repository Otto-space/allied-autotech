import { afterEach, expect, it, vi } from "vitest";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { PromotionsService } from "../../src/modules/promotions/promotions.service.js";
import { promotionSelect } from "../../src/modules/promotions/promotions.repository.js";
import { draftTotals } from "../../src/modules/policies/policy-money.js";

const promotion = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Synthetic monetary rounding",
  code: "ROUNDING",
  description: null,
  discountType: "PERCENTAGE" as const,
  percentageBasisPoints: 5000,
  fixedAmountKobo: null,
  minimumOrderAmountKobo: null,
  maximumDiscountAmountKobo: null,
  usageLimit: null,
  perCustomerLimit: null,
  startsAt: new Date(0),
  endsAt: new Date("2100-01-01"),
  isActive: true,
  version: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
type PromotionRecord = Prisma.PromotionGetPayload<{ select: typeof promotionSelect }>;
function fixture(overrides: Partial<PromotionRecord> = {}) {
  const service = new PromotionsService({} as PrismaClient);
  vi.spyOn(service.repository, "lockByCode").mockResolvedValue({
    ...promotion,
    ...overrides,
  });
  vi.spyOn(service.repository, "usageCounts").mockResolvedValue([0, 0]);
  return service;
}
afterEach(() => vi.restoreAllMocks());
it.each([
  [10000n, 5000, 5000n],
  [10001n, 5000, 5001n],
  [10002n, 5000, 5001n],
  [10003n, 5000, 5002n],
  [10001n, 2500, 2500n],
  [10003n, 2500, 2501n],
  [9007199254740993n, 5000, 4503599627370497n],
] as const)(
  "rounds aggregate percentage discounts in integer kobo: %s at %s bps",
  async (subtotal, rate, expected) => {
    const service = fixture({ percentageBasisPoints: rate });
    for (const buyer of ["synthetic-customer", { guestId: "synthetic-guest" }]) {
      const result = await service.lockAndEvaluate(
        buyer,
        "ROUNDING",
        subtotal,
        {} as Prisma.TransactionClient,
      );
      expect(result.discountAmountKobo).toBe(expected);
    }
  },
);
it("keeps the authorised cap after rounding and calculates VAT after that discount once", async () => {
  const service = fixture({ maximumDiscountAmountKobo: 5000n });
  const result = await service.lockAndEvaluate(
    "synthetic-customer",
    "ROUNDING",
    10001n,
    {} as Prisma.TransactionClient,
  );
  expect(result.discountAmountKobo).toBe(5000n);
  expect(draftTotals(10001n, result.discountAmountKobo)).toEqual({
    subtotalKobo: 10001n,
    discountKobo: 5000n,
    taxKobo: 375n,
    totalKobo: 5376n,
  });
});

it("keeps fixed discounts unchanged by the percentage rule", async () => {
  const service = fixture({
    discountType: "FIXED_AMOUNT",
    fixedAmountKobo: 3001n,
    percentageBasisPoints: null,
  });
  const result = await service.lockAndEvaluate(
    "synthetic-customer",
    "ROUNDING",
    10001n,
    {} as Prisma.TransactionClient,
  );
  expect(result.discountAmountKobo).toBe(3001n);
});
