import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  role: "ADMIN",
  email: "requester@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
};
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };

describe("refund request current-session boundary", () => {
  it("denies a revoked requester before replay lookup or creation", async () => {
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
      refund: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      paymentAttempt: { findUnique: vi.fn() },
      auditLog: { create: vi.fn() },
    };
    const database = {
      $transaction: vi.fn(async (run: (tx: typeof transaction) => unknown) =>
        run(transaction),
      ),
    };

    await expect(
      new PaymentsService(database as never).requestRefund(
        actor,
        { paymentAttemptId: randomUUID(), amountKobo: 1_000n, reason: "Test" },
        randomUUID(),
        context,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    expect(transaction.session.findFirst).toHaveBeenCalledOnce();
    expect(transaction.refund.findUnique).not.toHaveBeenCalled();
    expect(transaction.paymentAttempt.findUnique).not.toHaveBeenCalled();
    expect(transaction.refund.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });
});
