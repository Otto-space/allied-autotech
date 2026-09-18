import { describe, it, expect } from "vitest";
import {
  promotionBody,
  promotionDefaults,
  promotionFormSchema,
} from "@/lib/forms/promotion";
const draft = () => ({
  ...promotionDefaults(),
  name: "Test promotion",
  code: "test-code",
  percentage: "12.34",
  startsAt: "2026-09-17T10:00",
  endsAt: "2026-09-18T10:00",
});
describe("promotion monetary and eligibility boundaries", () => {
  it("retains valid sub-minute windows without rounding either boundary", () => {
    const value = promotionFormSchema.parse({
      ...draft(),
      startsAt: "2026-09-17T10:00:37.100",
      endsAt: "2026-09-17T10:00:37.200",
    });
    expect(promotionBody(value)).toMatchObject({
      startsAt: "2026-09-17T10:00:37.100+01:00",
      endsAt: "2026-09-17T10:00:37.200+01:00",
    });
  });
  it("converts fractional percentages and large NGN values exactly, preserving nulls and Lagos time", () => {
    const body = promotionBody(
      promotionFormSchema.parse({
        ...draft(),
        maximumDiscountAmount: "99999999999999.99",
        minimumOrderAmount: "0.01",
      }),
    );
    expect(body).toMatchObject({
      percentageBasisPoints: 1234,
      fixedAmountKobo: null,
      minimumOrderAmountKobo: "1",
      maximumDiscountAmountKobo: "9999999999999999",
      usageLimit: null,
      perCustomerLimit: null,
      startsAt: "2026-09-17T10:00:00+01:00",
      code: "TEST-CODE",
    });
  });
  it("rejects over-precision, out-of-range discounts, inverted windows and inconsistent limits", () => {
    for (const percentage of ["0", "0.001", "100.01", "-1", "1e2", "NaN"])
      expect(promotionFormSchema.safeParse({ ...draft(), percentage }).success).toBe(
        false,
      );
    for (const change of [
      { endsAt: "2026-09-17T10:00" },
      { endsAt: "2026-02-30T10:00" },
      { usageLimit: "2", perCustomerLimit: "3" },
      { maximumDiscountAmount: "100000000000000.00" },
    ])
      expect(promotionFormSchema.safeParse({ ...draft(), ...change }).success).toBe(
        false,
      );
  });
  it("fixed discounts clear percentage data and preserve an explicit zero cap", () => {
    expect(
      promotionBody(
        promotionFormSchema.parse({
          ...draft(),
          discountType: "FIXED_AMOUNT",
          fixedAmount: "25.01",
          maximumDiscountAmount: "0",
        }),
      ),
    ).toMatchObject({
      percentageBasisPoints: null,
      fixedAmountKobo: "2501",
      maximumDiscountAmountKobo: "0",
    });
  });
});
