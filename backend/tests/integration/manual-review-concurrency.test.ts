import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { PrismaClient } from "../../src/generated/prisma/client.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function actor(role: "CUSTOMER" | "ADMIN"): Promise<AuthenticatedActor> {
  const account = await prisma.user.create({
    data: {
      email: `manual-race-${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-password",
      role,
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Isolated",
                lastName: "Review",
                phone: "+2348000000000",
              },
            },
          }
        : {}),
    },
  });
  return {
    userId: account.id,
    email: account.email,
    role,
    sessionId: randomUUID(),
    mfaRequired: role !== "CUSTOMER",
    mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
  };
}
async function pendingReview() {
  const customer = await actor("CUSTOMER");
  const profile = await prisma.customerProfile.findUniqueOrThrow({
    where: { userId: customer.userId },
  });
  const branch = await prisma.branch.create({
    data: {
      code: `MR-${randomUUID().slice(0, 8)}`,
      name: "Isolated review race",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      customerId: profile.id,
      branchId: branch.id,
      orderNumber: `MR-${randomUUID()}`,
      status: "PENDING",
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      customerName: "Isolated Review",
      customerEmail: customer.email,
      customerPhone: "+2348000000000",
      paymentDueAt: new Date(Date.now() + 3600000),
    },
  });
  const service = new PaymentsService(prisma);
  await service.createIntent(
    customer,
    { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
    randomUUID(),
    context(),
  );
  const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
  await service.submitManual(
    customer,
    payment.id,
    {
      method: "BANK_TRANSFER",
      bankReference: `MR-${randomUUID()}`,
      payerName: "Isolated Review",
      transferredAt: new Date().toISOString(),
    },
    randomUUID(),
    context(),
  );
  const attempt = await prisma.paymentAttempt.findFirstOrThrow({
    where: { paymentId: payment.id },
  });
  return { customer, order, payment, attempt };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Concurrent manual payment decisions",
  () => {
    afterAll(async () => prisma.$disconnect());
    for (const secondDecision of ["APPROVED", "REJECTED"] as const)
      it(`accepts exactly one decision when approval races ${secondDecision.toLowerCase()}`, async () => {
        const fixture = await pendingReview();
        const reviewers = await Promise.all([actor("ADMIN"), actor("ADMIN")]);
        let reads = 0;
        let release!: () => void;
        const bothRead = new Promise<void>((resolve) => {
          release = resolve;
        });
        // Only synchronize reads. Every write, constraint, settlement and audit runs in PostgreSQL.
        const database = prisma.$extends({
          query: {
            paymentAttempt: {
              async findUnique({ args, query }) {
                const result = await query(args);
                if (args.where.id === fixture.attempt.id && args.include?.manualReview) {
                  if (++reads === 2) release();
                  await bothRead;
                }
                return result;
              },
            },
          },
        }) as unknown as PrismaClient;
        const service = new PaymentsService(database);
        const decisions = ["APPROVED", secondDecision] as const;
        const results = await Promise.allSettled(
          reviewers.map((reviewer, index) =>
            service.reviewManual(
              reviewer,
              fixture.attempt.id,
              {
                decision: decisions[index]!,
                reviewerNote: "Independently matched isolated evidence",
              },
              context(),
            ),
          ),
        );
        expect(reads).toBe(2);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((result) => result.status === "rejected");
        expect(rejected?.status === "rejected" && rejected.reason.statusCode).toBe(409);
        const stored = await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: fixture.attempt.id },
          include: { manualReview: true, payment: true },
        });
        const winner = results.findIndex((result) => result.status === "fulfilled");
        expect(stored.manualReview?.reviewedByUserId).toBe(reviewers[winner]!.userId);
        expect(stored.manualReview?.status).toBe(decisions[winner]);
        const approved = decisions[winner] === "APPROVED";
        expect(stored.status).toBe(approved ? "SUCCESSFUL" : "FAILED");
        expect(stored.payment.status).toBe(approved ? "SUCCEEDED" : "REQUIRES_PAYMENT");
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: stored.id, type: "CAPTURE" },
          }),
        ).toBe(approved ? 1 : 0);
        expect(
          await prisma.auditLog.count({
            where: {
              entityType: "PAYMENT_ATTEMPT",
              entityId: stored.id,
              action: { in: ["MANUAL_PAYMENT_APPROVED", "STATUS_CHANGE"] },
            },
          }),
        ).toBe(1);
      }, 20000);
  },
);
