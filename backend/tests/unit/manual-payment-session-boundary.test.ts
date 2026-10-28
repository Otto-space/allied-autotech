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

describe("manual payment review current-session boundary", () => {
  it.each(["APPROVED", "REJECTED"] as const)(
    "denies a revoked approver before recording a %s decision",
    async (decision) => {
      const transaction = {
        $executeRaw: vi.fn().mockResolvedValue(0),
        $queryRaw: vi.fn().mockResolvedValue([]),
        user: {
          findUnique: vi.fn().mockResolvedValue({
            role: "ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
            passwordHash: "synthetic-hash",
          }),
        },
        session: { findFirst: vi.fn().mockResolvedValue(null) },
        paymentAttempt: {
          findUnique: vi.fn().mockResolvedValue({
            id: randomUUID(),
            paymentId: randomUUID(),
            provider: "MANUAL",
            manualReview: {
              id: randomUUID(),
              status: "PENDING",
              submittedByUserId: randomUUID(),
            },
          }),
          update: vi.fn(),
        },
        manualPaymentReview: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        payment: { updateMany: vi.fn() },
        auditLog: { create: vi.fn() },
      };
      const database = {
        $transaction: vi.fn(async (run: (tx: typeof transaction) => unknown) =>
          run(transaction),
        ),
      };

      await expect(
        new PaymentsService(database as never).reviewManual(
          actor,
          randomUUID(),
          { decision, reviewerNote: "Synthetic independent review" },
          context,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
      expect(transaction.session.findFirst).toHaveBeenCalledOnce();
      expect(transaction.paymentAttempt.findUnique).not.toHaveBeenCalled();
      expect(transaction.manualPaymentReview.updateMany).not.toHaveBeenCalled();
      expect(transaction.paymentAttempt.update).not.toHaveBeenCalled();
      expect(transaction.auditLog.create).not.toHaveBeenCalled();
    },
  );
});
