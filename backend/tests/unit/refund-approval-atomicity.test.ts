import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  role: "ADMIN",
  email: "approver@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
};
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };

function refundWorkspace(
  provider: "MANUAL" | "PAYSTACK",
  gatewayTransactionId: string | null,
) {
  const id = randomUUID();
  let record = {
    id,
    requestedByUserId: randomUUID(),
    paymentAttemptId: randomUUID(),
    paymentAttempt: { provider, gatewayTransactionId },
    amountKobo: 20_000n,
    status: "REQUESTED",
    providerStatus: null as string | null,
    approvedByUserId: null as string | null,
    approvedAt: null as Date | null,
  };
  const authorization = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      }),
    },
    userCapability: { findFirst: vi.fn().mockResolvedValue({ id: randomUUID() }) },
  };
  const transaction = {
    ...authorization,
    $queryRaw: vi.fn().mockResolvedValue([{ id }]),
    paymentDispute: { count: vi.fn().mockResolvedValue(0) },
    refund: {
      findUnique: vi.fn(async () => record),
      findUniqueOrThrow: vi.fn(async () => record),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        record = { ...record, ...data } as typeof record;
        return record;
      }),
    },
    businessPolicyVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn().mockResolvedValue({ id: randomUUID() }) },
  };
  const database = {
    ...authorization,
    $transaction: vi.fn(async (run: (tx: typeof transaction) => unknown) =>
      run(transaction),
    ),
    refund: {
      findUniqueOrThrow: vi.fn(async () => record),
      update: vi.fn(() => {
        throw new Error("A post-commit refund update is unsafe");
      }),
    },
  };
  return {
    id,
    database,
    transaction,
    service: new PaymentsService(database as never),
    current: () => record,
  };
}

describe("refund approval publication", () => {
  it.each([
    { provider: "MANUAL" as const, gatewayTransactionId: null },
    { provider: "PAYSTACK" as const, gatewayTransactionId: null },
  ])(
    "commits $provider without a provider transaction directly to review",
    async ({ provider, gatewayTransactionId }) => {
      const { id, database, transaction, service, current } = refundWorkspace(
        provider,
        gatewayTransactionId,
      );

      await expect(
        service.decideRefund(actor, id, { decision: "APPROVED" }, context),
      ).resolves.toMatchObject({
        id,
        status: "NEEDS_ATTENTION",
        providerStatus: "OFFLINE_PROCESSING_REQUIRED",
      });
      expect(current()).toMatchObject({
        status: "NEEDS_ATTENTION",
        approvedByUserId: actor.userId,
      });
      expect(transaction.refund.update).toHaveBeenCalledOnce();
      expect(transaction.auditLog.create).toHaveBeenCalledOnce();
      expect(database.refund.update).not.toHaveBeenCalled();
    },
  );

  it("keeps a provider-ready refund approved for worker dispatch", async () => {
    const { id, database, service, current } = refundWorkspace("PAYSTACK", "captured-id");

    await expect(
      service.decideRefund(actor, id, { decision: "APPROVED" }, context),
    ).resolves.toMatchObject({ id, status: "APPROVED" });
    expect(current().providerStatus).toBeNull();
    expect(database.refund.update).not.toHaveBeenCalled();
  });
});
