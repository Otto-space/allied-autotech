import { describe, it, expect } from "vitest";
import {
  verifiedOrderRefundSettlement,
  type RefundSettlementEvidence,
} from "../../src/modules/payments/refund-settlement-evidence.js";
const id = (n: number) => `a1180000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = new Date("2026-11-10T12:00:00Z"),
  earlier = new Date("2026-11-10T11:00:00Z");
function fixture(): RefundSettlementEvidence {
  return {
    id: id(1),
    paymentAttemptId: id(2),
    supplyRemedyChoiceId: id(3),
    amountKobo: 107n,
    currency: "NGN",
    status: "SUCCEEDED",
    authorizationKind: "HUMAN",
    requestedByUserId: id(4),
    approvedByUserId: id(5),
    requestedAt: earlier,
    approvedAt: earlier,
    processedAt: earlier,
    policyVersionId: null,
    policySnapshot: null,
    providerRefundId: null,
    providerStatus: "BANK_TRANSFER_CHECKED",
    transferredByUserId: id(6),
    transferRecordedAt: earlier,
    bankTransferAt: earlier,
    bankReference: "synthetic-private-bank-reference",
    evidenceObjectKey: "synthetic-private-evidence",
    evidenceSha256: "a".repeat(64),
    beneficiaryEncrypted: { synthetic: "not bank data" },
    checkedByUserId: id(7),
    checkedAt: earlier,
    anomalies: [],
    ledgerEntries: [
      {
        id: id(8),
        refundId: id(1),
        paymentAttemptId: null,
        disputeId: null,
        sourceKey: `refund:${id(1)}`,
        type: "REFUND",
        direction: "DEBIT",
        amountKobo: 107n,
        currency: "NGN",
        occurredAt: earlier,
      },
    ],
    paymentAttempt: {
      id: id(2),
      paymentId: id(9),
      provider: "MANUAL",
      status: "SUCCESSFUL",
      verificationStatus: "VERIFIED",
      amountKobo: 320n,
      currency: "NGN",
      verifiedAmountKobo: 320n,
      verifiedCurrency: "NGN",
      paidAt: earlier,
      verifiedAt: earlier,
      anomalies: [],
      disputes: [],
      payment: {
        id: id(9),
        orderId: id(10),
        amountKobo: 320n,
        currency: "NGN",
        anomalies: [],
      },
    },
  };
}
describe("actual order refund settlement evidence", () => {
  it("caps the sum of distinct refunds against one actual captured attempt", () => {
    const first = fixture(),
      second = structuredClone(first);
    first.amountKobo = 60n;
    first.ledgerEntries[0]!.amountKobo = 60n;
    first.paymentAttempt.amountKobo = 80n;
    first.paymentAttempt.verifiedAmountKobo = 80n;
    first.paymentAttempt.payment.amountKobo = 80n;
    second.id = id(21);
    second.amountKobo = 47n;
    second.ledgerEntries[0] = {
      ...second.ledgerEntries[0]!,
      id: id(22),
      refundId: second.id,
      sourceKey: `refund:${second.id}`,
      amountKobo: 47n,
    };
    second.paymentAttempt = structuredClone(first.paymentAttempt);
    expect(() =>
      verifiedOrderRefundSettlement(id(10), 107n, [first, second], now),
    ).toThrow();
  });
  it("retains only exact settled amount and ledger identities, excluding private bank/operator fields", () => {
    const proof = verifiedOrderRefundSettlement(id(10), 107n, [fixture()], now);
    expect(proof.amountKobo).toBe("107");
    expect(proof.refunds[0]!.ledgerEntryId).toBe(id(8));
    expect(JSON.stringify(proof)).not.toMatch(
      /private-bank|private-evidence|beneficiary|checkedBy|requestedBy/,
    );
  });
  it.each(["REQUESTED", "APPROVED", "PENDING", "PROCESSING", "NEEDS_ATTENTION"] as const)(
    "never treats %s as return of money",
    (status) => {
      const row = fixture();
      row.status = status;
      expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
    },
  );
  it("requires exact ledger amount, direction, source, identity and complete evidence", () => {
    for (const patch of [
      { amountKobo: 106n },
      { direction: "CREDIT" as const },
      { currency: "USD" },
      { sourceKey: "different-source" },
      { refundId: id(99) },
      { paymentAttemptId: id(99) },
      { disputeId: id(99) },
    ]) {
      const row = fixture();
      Object.assign(row.ledgerEntries[0]!, patch);
      expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
    }
    const row = fixture();
    row.ledgerEntries = [];
    expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
  });
  it("preserves independent manual approval, transfer and checking requirements", () => {
    for (const patch of [
      { approvedByUserId: id(4) },
      { transferredByUserId: id(5) },
      { checkedByUserId: id(6) },
      { bankReference: null },
      { evidenceSha256: null },
      { beneficiaryEncrypted: null },
      { providerStatus: "BANK_TRANSFER_RECORDED" },
      { checkedAt: null },
    ]) {
      const row = fixture();
      Object.assign(row, patch);
      expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
    }
  });
  it("rejects foreign, mismatched capture, disputed, anomalous or future evidence", () => {
    const foreign = fixture();
    expect(() => verifiedOrderRefundSettlement(id(99), 107n, [foreign], now)).toThrow();
    for (const patch of [
      { verificationStatus: "UNVERIFIED" },
      { verifiedAmountKobo: 321n },
      { status: "PENDING" },
      { anomalies: [{ status: "OPEN" }] },
      { disputes: [{ status: "OPEN" }] },
    ]) {
      const row = fixture();
      Object.assign(row.paymentAttempt, patch);
      expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
    }
    const row = fixture();
    row.processedAt = new Date(now.getTime() + 1);
    expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
  });
  it("uses bigint exact totals and never counts failed/cancelled requests or duplicate receipts", () => {
    const row = fixture();
    expect(() => verifiedOrderRefundSettlement(id(10), 108n, [row], now)).toThrow();
    expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row, row], now)).toThrow();
    expect(
      verifiedOrderRefundSettlement(
        id(10),
        107n,
        [
          row,
          { ...fixture(), id: id(11), status: "FAILED" },
          { ...fixture(), id: id(12), status: "CANCELLED" },
        ],
        now,
      ).amountKobo,
    ).toBe("107");
  });
  it("requires provider refund identity and an actual approved policy for the existing late technical reversal", () => {
    const row = fixture();
    row.paymentAttempt.provider = "PAYSTACK";
    row.providerRefundId = "synthetic-provider-refund";
    row.authorizationKind = "SYSTEM_LATE_ORDER";
    row.requestedByUserId = null;
    row.approvedByUserId = null;
    expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
    row.policyVersionId = id(13);
    row.policySnapshot = { id: id(13), key: "order-payment", approvalStatus: "APPROVED" };
    expect(
      verifiedOrderRefundSettlement(id(10), 107n, [row], now).refunds[0]!.source,
    ).toBe("PAYSTACK");
    row.providerRefundId = null;
    expect(() => verifiedOrderRefundSettlement(id(10), 107n, [row], now)).toThrow();
  });
});
