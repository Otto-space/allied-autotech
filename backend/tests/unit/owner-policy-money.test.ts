import { describe, expect, it } from "vitest";
import {
  basisPoints,
  cancellationAssessment,
  draftTotals,
  draftVehicleRefund,
} from "../../src/modules/policies/policy-money.js";
import { parsePaystackWebhook } from "../../src/providers/payments/paystack-webhook.js";

describe("Signed owner decisions: labelled draft financial assumptions", () => {
  it("adds VAT in integer kobo under the simple 750 bps test policy", () => {
    expect(draftTotals(10_000_000n)).toMatchObject({
      taxKobo: 750_000n,
      totalKobo: 10_750_000n,
    });
    expect(basisPoints(20n, 750)).toBe(2n);
    expect(() => draftTotals(100n, 101n)).toThrow();
  });
  it("bases the proposed change-of-mind fee on vehicle value and caps the refund", () => {
    expect(
      draftVehicleRefund(1_000_000_000n, 700_000_000n, 0n, "BUYER_CHANGE"),
    ).toMatchObject({
      proposedDepositKobo: 700_000_000n,
      proposedFeeKobo: 5_000_000n,
      proposedRefundKobo: 695_000_000n,
      requiresApproval: true,
    });
    expect(
      draftVehicleRefund(1_000_000_000n, 700_000_000n, 699_000_000n, "BUYER_CHANGE")
        .proposedRefundKobo,
    ).toBe(0n);
    expect(
      draftVehicleRefund(1_000_000_000n, 700_000_000n, 0n, "BUSINESS_FAILURE")
        .proposedFeeKobo,
    ).toBe(0n);
  });
  it("keeps the exact threshold and absent monetary basis under review", () => {
    expect(cancellationAssessment(false, false)).toEqual({
      feeKobo: 0n,
      requiresReview: false,
    });
    expect(cancellationAssessment(true, false)).toEqual({
      feeKobo: null,
      requiresReview: true,
    });
    expect(cancellationAssessment(true, false, 10_000_000n).feeKobo).toBeNull();
    // Explicit test assumption: supplied reviewed basis is a single eligible item pre-tax.
    expect(cancellationAssessment(true, false, 5_000_000n).feeKobo).toBe(500_000n);
    expect(cancellationAssessment(true, false, 20_000_000n).feeKobo).toBe(1_000_000n);
    expect(cancellationAssessment(true, true, 20_000_000n).feeKobo).toBeNull();
  });
  it("accepts Paystack's documented refund event with string amount and no numeric id", () => {
    const event = parsePaystackWebhook(
      Buffer.from(
        JSON.stringify({
          event: "refund.pending",
          data: {
            status: "pending",
            transaction_reference: "original-charge",
            refund_reference: null,
            amount: "10000",
            currency: "NGN",
          },
        }),
      ),
    );
    expect(event).toMatchObject({
      amountKobo: 10000n,
      resourceId: null,
      reference: "original-charge",
      status: "pending",
    });
  });
});
