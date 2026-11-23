import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { requestEarlyBookingDepositRefundReview } from "../../src/modules/payments/refund-workflow.js";

vi.mock("../../src/modules/audit/audit.service.js", () => ({
  appendAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

function fixture() {
  const attempt = {
    id: randomUUID(),
    amountKobo: 20_000n,
    currency: "NGN",
  };
  const created: unknown[] = [];
  const tx = {
    paymentAttempt: { findMany: vi.fn().mockResolvedValue([attempt]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    businessPolicyVersion: {
      findFirst: vi.fn().mockResolvedValue({
        id: randomUUID(),
        key: "cancellation",
        version: 1,
        approvalStatus: "APPROVED",
        source: "synthetic fixture",
        effectiveAt: new Date(),
        settings: {},
      }),
    },
    refund: {
      findUnique: vi.fn().mockImplementation(async () => created[0] ?? null),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountKobo: 5_000n } }),
      create: vi.fn().mockImplementation(async ({ data }) => {
        const record = { ...data, id: randomUUID() };
        created.push(record);
        return record;
      }),
    },
  };
  return { tx, created };
}

describe("early customer booking cancellation deposit refund", () => {
  it("queues only the uncommitted balance for independent review, replay-safe", async () => {
    const { tx, created } = fixture();
    const bookingId = randomUUID();
    const requesterId = randomUUID();
    await requestEarlyBookingDepositRefundReview(tx as never, bookingId, requesterId);
    expect(tx.paymentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          payment: { bookingId, purpose: "BOOKING_DEPOSIT" },
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
        }),
      }),
    );
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      amountKobo: 15_000n,
      requestedByUserId: requesterId,
      policySnapshot: expect.objectContaining({ feeKobo: "0" }),
    });
    expect(created[0]).not.toHaveProperty("approvedAt");
    expect(created[0]).not.toHaveProperty("authorizationKind");
    await requestEarlyBookingDepositRefundReview(tx as never, bookingId, requesterId);
    expect(tx.refund.create).toHaveBeenCalledTimes(1);
  });

  it("makes no refund request if the booking has no verified charge", async () => {
    const { tx } = fixture();
    tx.paymentAttempt.findMany.mockResolvedValue([]);
    await requestEarlyBookingDepositRefundReview(tx as never, randomUUID(), randomUUID());
    expect(tx.refund.create).not.toHaveBeenCalled();
    expect(tx.businessPolicyVersion.findFirst).not.toHaveBeenCalled();
  });
});
