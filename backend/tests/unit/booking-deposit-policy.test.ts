import { describe, expect, it } from "vitest";
import { bookingDepositIntentBodySchema } from "../../src/modules/payments/payments.schemas.js";
import {
  bookingDepositBinding,
  bookingDepositCaptureWithinWindow,
  bookingDepositSettlementMatches,
} from "../../src/modules/payments/booking-deposit-binding.js";
import {
  approvedQuoteDeposit,
  approvedQuoteDepositPolicy,
  approvedQuoteDepositReady,
} from "../../src/modules/service-operations/booking-deposit-policy.js";

describe("approved quotation booking deposit", () => {
  it("allocates only provider captures within the accepted checkout window", () => {
    const window = {
      paymentCreatedAt: new Date("2026-11-23T10:00:00Z"),
      termsAcceptedAt: new Date("2026-11-23T10:00:00Z"),
      holdExpiresAt: new Date("2026-11-23T10:30:00Z"),
    };
    expect(
      bookingDepositCaptureWithinWindow({
        ...window,
        capturedAt: new Date("2026-11-23T10:15:00Z"),
      }),
    ).toBe(true);
    for (const capturedAt of [
      new Date("2026-11-23T09:59:59Z"),
      new Date("2026-11-23T10:30:01Z"),
      new Date(NaN),
    ]) {
      expect(bookingDepositCaptureWithinWindow({ ...window, capturedAt })).toBe(false);
    }
    expect(bookingDepositCaptureWithinWindow({ ...window, termsAcceptedAt: null, capturedAt: new Date("2026-11-23T10:15:00Z") })).toBe(false);
  });
  it("requires explicit deposit terms and an identified accepted quotation", () => {
    const accepted = {
      acceptedQuoteId: "e23601b5-fcdc-4b15-875d-8b084f6274d4",
      acceptedQuoteVersion: 2,
      acceptDepositTerms: true,
    };
    expect(bookingDepositIntentBodySchema.safeParse(accepted).success).toBe(true);
    expect(
      bookingDepositIntentBodySchema.safeParse({ ...accepted, acceptDepositTerms: false })
        .success,
    ).toBe(false);
    expect(
      bookingDepositIntentBodySchema.safeParse({ ...accepted, acceptedQuoteVersion: 0 })
        .success,
    ).toBe(false);
    expect(
      bookingDepositIntentBodySchema.safeParse({ ...accepted, amountKobo: "1" }).success,
    ).toBe(false);
  });

  it("rejects missing or malformed immutable payment bindings", () => {
    const binding = {
      policyVersion: "approved-quote-deposit-20-v1",
      quoteId: "e23601b5-fcdc-4b15-875d-8b084f6274d4",
      quoteVersion: 2,
      quoteTotalKobo: "1000000",
      depositAmountKobo: "200000",
      scheduleVersion: 1,
      assignedStaffId: "0f81be79-07e9-4c9b-954d-586aa194251a",
    };
    expect(bookingDepositBinding({ bookingDeposit: binding })).toEqual(binding);
    expect(bookingDepositBinding(null)).toBeNull();
    expect(bookingDepositBinding({})).toBeNull();
    expect(
      bookingDepositBinding({
        bookingDeposit: { ...binding, quoteTotalKobo: -1 },
      }),
    ).toBeNull();
    expect(
      bookingDepositBinding({
        bookingDeposit: { ...binding, assignedStaffId: "not-a-staff-id" },
      }),
    ).toBeNull();
    expect(
      bookingDepositBinding({
        bookingDeposit: { ...binding, unexpectedField: "ignored?" },
      }),
    ).toBeNull();
  });

  it("holds captured funds for review when the quote or staff schedule changed", () => {
    const binding = bookingDepositBinding({
      bookingDeposit: {
        policyVersion: "approved-quote-deposit-20-v1",
        quoteId: "e23601b5-fcdc-4b15-875d-8b084f6274d4",
        quoteVersion: 2,
        quoteTotalKobo: "1000000",
        depositAmountKobo: "200000",
        scheduleVersion: 3,
        assignedStaffId: "0f81be79-07e9-4c9b-954d-586aa194251a",
      },
    });
    const current = {
      binding,
      paymentAmountKobo: 200_000n,
      booking: {
        scheduleVersion: 3,
        assignedStaffId: binding!.assignedStaffId,
        depositBaseKobo: 1_000_000n,
        quotedPriceKobo: 1_000_000n,
        depositBasisPoints: 2_000,
        depositAmountKobo: 200_000n,
      },
      quote: {
        id: binding!.quoteId,
        version: 2,
        status: "ACCEPTED",
        totalKobo: 1_000_000n,
      },
    };
    expect(bookingDepositSettlementMatches(current)).toBe(true);
    expect(
      bookingDepositSettlementMatches({
        ...current,
        booking: { ...current.booking, scheduleVersion: 4 },
      }),
    ).toBe(false);
    expect(
      bookingDepositSettlementMatches({
        ...current,
        booking: { ...current.booking, assignedStaffId: "another-staff" },
      }),
    ).toBe(false);
    expect(
      bookingDepositSettlementMatches({
        ...current,
        quote: { ...current.quote, version: 3 },
      }),
    ).toBe(false);
    expect(
      bookingDepositSettlementMatches({
        ...current,
        paymentAmountKobo: 300_000n,
      }),
    ).toBe(false);
    expect(bookingDepositSettlementMatches({ ...current, binding: null })).toBe(false);
  });
  it("calculates an exact 20% deposit and preserves the 80% physical balance", () => {
    const amount = approvedQuoteDeposit(100_000_00n);
    expect(amount).toEqual({
      policyVersion: "approved-quote-deposit-20-v1",
      approvedTotalKobo: 100_000_00n,
      depositBasisPoints: 2_000,
      depositAmountKobo: 20_000_00n,
      remainingAmountKobo: 80_000_00n,
    });
    expect(approvedQuoteDepositPolicy.basisPoints).toBe(2_000);
  });

  it("rounds half-up to a whole kobo with no lost value", () => {
    const amount = approvedQuoteDeposit(503n);
    expect(amount.depositAmountKobo).toBe(101n);
    expect(amount.remainingAmountKobo).toBe(402n);
    expect(amount.depositAmountKobo + amount.remainingAmountKobo).toBe(503n);
  });

  it("rejects unknown, non-positive, and unpayably small totals", () => {
    expect(() => approvedQuoteDeposit(0n)).toThrow();
    expect(() => approvedQuoteDeposit(-1n)).toThrow();
    expect(() => approvedQuoteDeposit(1n)).toThrow();
  });

  it("opens checkout only for the customer-accepted quote and staff-approved slot", () => {
    const ready = {
      bookingId: "booking-1",
      bookingStatus: "CONFIRMED",
      confirmedAt: new Date(),
      branchId: "branch-1",
      assignedStaffId: "staff-1",
      capacityPolicyVersionId: "capacity-1",
      depositPaidAt: null,
      latestQuoteVersion: 3,
      quote: {
        bookingId: "booking-1",
        version: 3,
        status: "ACCEPTED",
        acceptedAt: new Date(),
        totalKobo: 50_000n,
        originalInvoiceId: null,
      },
    };
    expect(approvedQuoteDepositReady(ready)).toBe(true);
    expect(approvedQuoteDepositReady({ ...ready, bookingStatus: "REQUESTED" })).toBe(
      false,
    );
    expect(approvedQuoteDepositReady({ ...ready, confirmedAt: null })).toBe(false);
    expect(approvedQuoteDepositReady({ ...ready, assignedStaffId: null })).toBe(false);
    expect(approvedQuoteDepositReady({ ...ready, capacityPolicyVersionId: null })).toBe(
      false,
    );
    expect(approvedQuoteDepositReady({ ...ready, quote: null })).toBe(false);
    expect(approvedQuoteDepositReady({ ...ready, depositPaidAt: new Date() })).toBe(
      false,
    );
    expect(approvedQuoteDepositReady({ ...ready, latestQuoteVersion: 4 })).toBe(false);
    expect(
      approvedQuoteDepositReady({
        ...ready,
        quote: { ...ready.quote, acceptedAt: null },
      }),
    ).toBe(false);
    expect(
      approvedQuoteDepositReady({
        ...ready,
        quote: { ...ready.quote, status: "ISSUED" },
      }),
    ).toBe(false);
    expect(
      approvedQuoteDepositReady({
        ...ready,
        quote: { ...ready.quote, bookingId: "another-booking" },
      }),
    ).toBe(false);
    expect(
      approvedQuoteDepositReady({
        ...ready,
        quote: { ...ready.quote, originalInvoiceId: "another-invoice" },
      }),
    ).toBe(false);
  });
});
