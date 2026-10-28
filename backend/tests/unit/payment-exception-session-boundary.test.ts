import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";

const actor: AuthenticatedActor = {
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  role: "ADMIN",
  email: "administrator@example.test",
  mfaRequired: true,
  mfaVerifiedAt: new Date(),
};
const context = { requestId: crypto.randomUUID(), ipAddress: null, userAgent: null };
const id = crypto.randomUUID();

function workspace(sessionCurrent: boolean) {
  const transaction = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        passwordHash: "test-only-hash",
      }),
    },
    session: {
      findFirst: vi
        .fn()
        .mockResolvedValue(sessionCurrent ? { mfaVerifiedAt: new Date() } : null),
    },
    paymentAnomaly: {
      findUnique: vi.fn().mockResolvedValue({ status: "INVESTIGATING" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id, status: "RESOLVED" }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }) },
  };
  const database = {
    $transaction: vi.fn(async (run: (tx: typeof transaction) => unknown) =>
      run(transaction),
    ),
  };
  return { transaction, service: new AuditOperationsService(database as never) };
}

describe("payment exception current-session boundary", () => {
  it.each([
    { expectedStatus: "OPEN" as const, status: "INVESTIGATING" as const },
    { expectedStatus: "INVESTIGATING" as const, status: "RESOLVED" as const },
  ])("rejects a revoked actor before changing $status", async (transition) => {
    const { service, transaction } = workspace(false);
    await expect(
      service.updateAnomaly(
        actor,
        id,
        { ...transition, resolutionNote: "Compared current source records." },
        context,
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(transaction.session.findFirst).toHaveBeenCalledOnce();
    expect(transaction.paymentAnomaly.findUnique).not.toHaveBeenCalled();
    expect(transaction.paymentAnomaly.updateMany).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("retains the conditional change and audit for a current administrator", async () => {
    const { service, transaction } = workspace(true);

    await expect(
      service.updateAnomaly(
        actor,
        id,
        {
          expectedStatus: "INVESTIGATING",
          status: "RESOLVED",
          resolutionNote: "Compared current source records.",
        },
        context,
      ),
    ).resolves.toMatchObject({ id, status: "RESOLVED" });
    expect(transaction.session.findFirst).toHaveBeenCalledOnce();
    expect(transaction.paymentAnomaly.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, status: "INVESTIGATING" } }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledOnce();
  });
});
