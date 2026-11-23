import { describe, expect, it } from "vitest";
import { bookingDepositCredit } from "../../src/modules/billing/booking-deposit-credit.js";

const paid = {
  bookingSlotId: null,
  depositPolicyVersion: "approved-quote-deposit-20-v1",
  depositBaseKobo: 1_000_001n,
  depositBasisPoints: 2_000,
  depositAmountKobo: 200_000n,
  depositPaidAt: new Date("2026-11-23T10:00:00Z"),
  depositForfeitedAt: null,
  depositPaymentStatus: "SUCCEEDED",
  refundedKobo: 0n,
  acceptedQuoteTotalKobo: 1_000_001n,
};

describe("booking deposit invoice credit", () => {
  it("credits the verified 20% payment without a published slot", () => {
    expect(bookingDepositCredit(paid)).toBe(200_000n);
    expect(bookingDepositCredit({ ...paid, refundedKobo: 25_000n })).toBe(175_000n);
  });

  it("never credits a merely initialized or unallocated payment", () => {
    expect(bookingDepositCredit({ ...paid, depositPaymentStatus: "PENDING" })).toBe(0n);
    expect(bookingDepositCredit({ ...paid, depositPaidAt: null })).toBe(0n);
    expect(bookingDepositCredit({ ...paid, depositForfeitedAt: new Date() })).toBe(0n);
  });

  it("rejects a deposit that no longer matches the accepted quote", () => {
    expect(() => bookingDepositCredit({ ...paid, depositBaseKobo: 900_000n })).toThrow();
    expect(() => bookingDepositCredit({ ...paid, depositAmountKobo: 300_000n })).toThrow();
    expect(() => bookingDepositCredit({ ...paid, refundedKobo: 200_001n })).toThrow();
  });

  it("preserves legacy slot-based credit rules", () => {
    const legacy = {
      ...paid,
      bookingSlotId: "slot-1",
      depositPolicyVersion: "owner-booking-request-v2",
      depositBaseKobo: null,
      depositBasisPoints: 3_000,
      depositAmountKobo: 300_000n,
    };
    expect(bookingDepositCredit(legacy)).toBe(300_000n);
    expect(bookingDepositCredit({ ...legacy, bookingSlotId: null })).toBe(0n);
  });
});
