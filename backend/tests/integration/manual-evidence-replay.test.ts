import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { issuePaymentEvidenceTicket } from "../../src/common/security/payment-evidence-tickets.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import type { ObjectStoragePort } from "../../src/providers/storage/object-storage.port.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function customer(): Promise<AuthenticatedActor> {
  const user = await prisma.user.create({
    data: {
      email: `evidence-${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-password",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Isolated", lastName: "Evidence", phone: "+2348000000000" },
      },
    },
  });
  return {
    userId: user.id,
    email: user.email,
    role: "CUSTOMER",
    sessionId: randomUUID(),
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
}
async function fixture() {
  const owner = await customer();
  const profile = await prisma.customerProfile.findUniqueOrThrow({
    where: { userId: owner.userId },
  });
  const branch = await prisma.branch.create({
    data: {
      code: `ER-${randomUUID().slice(0, 8)}`,
      name: "Evidence test",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      customerId: profile.id,
      branchId: branch.id,
      orderNumber: `ER-${randomUUID()}`,
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      customerName: "Isolated Evidence",
      customerEmail: owner.email,
      customerPhone: "+2348000000000",
      paymentDueAt: new Date(Date.now() + 3600000),
    },
  });
  const verifyObject = vi.fn<ObjectStoragePort["verifyObject"]>().mockResolvedValue(true);
  const unused = async (): Promise<never> => {
    throw new Error("Unexpected storage operation");
  };
  const service = new PaymentsService(prisma, undefined, {
    verifyObject,
    createUpload: unused,
    createDownload: unused,
    createView: unused,
  });
  await service.createIntent(
    owner,
    { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
    randomUUID(),
    context(),
  );
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
  const ticket = issuePaymentEvidenceTicket({
    actorUserId: owner.userId,
    paymentId: payment.id,
    mimeType: "application/pdf",
    sizeBytes: 1024,
    checksumSha256: "a".repeat(64),
  });
  const input = {
    method: "BANK_TRANSFER" as const,
    payerName: "Isolated Evidence",
    transferredAt: new Date().toISOString(),
    bankReference: "SYNTHETIC-ONLY",
    evidenceToken: ticket.ticket,
  };
  return { owner, payment, service, verifyObject, input, ticket, key: randomUUID() };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Owned manual evidence replay",
  () => {
    afterAll(async () => prisma.$disconnect());
    afterEach(() => vi.restoreAllMocks());
    it("recovers a committed original request after ticket expiry without contacting unavailable storage", async () => {
      const f = await fixture();
      await f.service.submitManual(f.owner, f.payment.id, f.input, f.key, context());
      expect(f.verifyObject).toHaveBeenCalledTimes(1);
      f.verifyObject.mockRejectedValue(new Error("Synthetic storage outage"));
      vi.spyOn(Date, "now").mockReturnValue(f.ticket.payload.expiresAt + 1);
      const replay = await f.service.submitManual(
        f.owner,
        f.payment.id,
        f.input,
        f.key,
        context(),
      );
      expect(replay).toMatchObject({
        id: f.payment.id,
        replayed: true,
        status: "REQUIRES_REVIEW",
      });
      expect(f.verifyObject).toHaveBeenCalledTimes(1);
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.payment.id } }),
      ).toBe(1);
      await expect(
        f.service.submitManual(
          f.owner,
          f.payment.id,
          { ...f.input, payerName: "Changed" },
          f.key,
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.service.submitManual(f.owner, f.payment.id, f.input, randomUUID(), context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.verifyObject).toHaveBeenCalledTimes(1);
    });
    it("never replays another customer's payment or trusts changed evidence on the same key", async () => {
      const f = await fixture();
      await f.service.submitManual(f.owner, f.payment.id, f.input, f.key, context());
      const other = await customer();
      await expect(
        f.service.submitManual(other, f.payment.id, f.input, f.key, context()),
      ).rejects.toMatchObject({ statusCode: 404 });
      const changedTicket = issuePaymentEvidenceTicket({
        ...f.ticket.payload,
        checksumSha256: "b".repeat(64),
      });
      await expect(
        f.service.submitManual(
          f.owner,
          f.payment.id,
          { ...f.input, evidenceToken: changedTicket.ticket },
          f.key,
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.verifyObject).toHaveBeenCalledTimes(1);
    });
    it("still requires current bound evidence and a verified object for a first submission", async () => {
      const f = await fixture();
      f.verifyObject.mockResolvedValue(false);
      await expect(
        f.service.submitManual(f.owner, f.payment.id, f.input, f.key, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.payment.id } }),
      ).toBe(0);
      f.verifyObject.mockResolvedValue(true);
      const unbound = issuePaymentEvidenceTicket({
        ...f.ticket.payload,
        actorUserId: randomUUID(),
      });
      await expect(
        f.service.submitManual(
          f.owner,
          f.payment.id,
          { ...f.input, evidenceToken: unbound.ticket },
          f.key,
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      vi.spyOn(Date, "now").mockReturnValue(
        Date.now() + env.ASSET_UPLOAD_TTL_SECONDS * 1000 + 1,
      );
      await expect(
        f.service.submitManual(f.owner, f.payment.id, f.input, f.key, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.verifyObject).toHaveBeenCalledTimes(1);
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.payment.id } }),
      ).toBe(0);
    });
    it("rechecks an original-key replay under the payment lock after concurrent object verification", async () => {
      const f = await fixture();
      let arrived = 0;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      f.verifyObject.mockImplementation(async () => {
        if (++arrived === 2) release();
        await ready;
        return true;
      });
      const results = await Promise.all(
        [1, 2].map(() =>
          f.service.submitManual(f.owner, f.payment.id, f.input, f.key, context()),
        ),
      );
      expect(
        results.filter((result) => "replayed" in result && result.replayed),
      ).toHaveLength(1);
      const attempts = await prisma.paymentAttempt.findMany({
        where: { paymentId: f.payment.id },
      });
      expect(attempts).toHaveLength(1);
      expect(
        await prisma.auditLog.count({
          where: {
            entityId: attempts[0]!.id,
            entityType: "PAYMENT_ATTEMPT",
            action: "CREATE",
          },
        }),
      ).toBe(1);
    }, 15000);
  },
);
