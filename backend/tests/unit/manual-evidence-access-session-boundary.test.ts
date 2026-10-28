import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  role: "ADMIN",
  email: "operator@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
};
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };

function fixture(sessionCurrent: boolean) {
  const attemptId = randomUUID();
  const objectKey = `private/manual-payment/${randomUUID()}`;
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
    session: {
      findFirst: vi
        .fn()
        .mockResolvedValue(sessionCurrent ? { mfaVerifiedAt: new Date() } : null),
    },
    paymentAttempt: {
      findUnique: vi.fn().mockResolvedValue({
        id: attemptId,
        paymentId: randomUUID(),
        manualReview: { evidenceObjectKey: objectKey },
      }),
    },
    auditLog: { create: vi.fn() },
  };
  const database = {
    $transaction: vi.fn(async (run: (tx: typeof transaction) => unknown) =>
      run(transaction),
    ),
    paymentAttempt: { findUnique: vi.fn() },
  };
  const storage = {
    createView: vi.fn().mockResolvedValue("https://example.test/private"),
  };
  const service = new PaymentsService(database as never, undefined, storage as never);
  return { attemptId, objectKey, transaction, database, storage, service };
}

describe("manual payment evidence access current-session boundary", () => {
  it("denies a revoked operator before reading or signing private evidence", async () => {
    const f = fixture(false);
    await expect(
      f.service.manualEvidenceAccess(actor, f.attemptId, context),
    ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
    expect(f.transaction.session.findFirst).toHaveBeenCalledOnce();
    expect(f.transaction.paymentAttempt.findUnique).not.toHaveBeenCalled();
    expect(f.transaction.auditLog.create).not.toHaveBeenCalled();
    expect(f.storage.createView).not.toHaveBeenCalled();
  });

  it("reads and audits the authorized evidence in the same transaction", async () => {
    const f = fixture(true);
    await expect(
      f.service.manualEvidenceAccess(actor, f.attemptId, context),
    ).resolves.toMatchObject({
      url: "https://example.test/private",
    });
    expect(f.transaction.paymentAttempt.findUnique).toHaveBeenCalledOnce();
    expect(f.database.paymentAttempt.findUnique).not.toHaveBeenCalled();
    expect(f.transaction.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: actor.userId,
        action: "READ",
        entityType: "PAYMENT_ATTEMPT",
        entityId: f.attemptId,
      }),
    });
    expect(f.storage.createView).toHaveBeenCalledWith(f.objectKey);
  });
});
