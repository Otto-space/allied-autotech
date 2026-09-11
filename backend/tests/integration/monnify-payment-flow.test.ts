import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";

import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import { prisma } from "../../src/config/database.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import { PaymentReconciliationWorker } from "../../src/workers/reconciliation.worker.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
const actor = (userId: string, role: AuthenticatedActor["role"]): AuthenticatedActor => ({
  userId,
  sessionId: randomUUID(),
  email: `${role.toLowerCase()}@example.test`,
  role,
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: role === "CUSTOMER" ? null : new Date(),
});

describe.skipIf(!runDatabaseTests)("Monnify payment flow", () => {
  afterAll(async () => prisma.$disconnect());

  it("encrypts checkout state, verifies sandbox events, and settles refunds once", async () => {
    const branch = await prisma.branch.create({
      data: {
        code: `MN-${randomUUID().slice(0, 8)}`,
        name: "Synthetic Monnify Branch",
        address: "1 Synthetic Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const customerId = randomUUID();
    const requesterId = randomUUID();
    const approverId = randomUUID();
    const passwordHash = await hashPassword(`synthetic passphrase ${randomUUID()}`);
    const customer = await prisma.user.create({
      data: {
        id: customerId,
        email: `monnify-customer-${customerId}@example.test`,
        passwordHash,
        role: "CUSTOMER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            firstName: "Synthetic",
            lastName: "Customer",
            phone: `+23481${customerId.replaceAll("-", "").slice(0, 8)}`,
          },
        },
      },
      select: { id: true, profile: { select: { id: true } } },
    });
    await Promise.all(
      [
        { id: requesterId, role: "ADMIN" as const },
        { id: approverId, role: "SUPER_ADMIN" as const },
      ].map(({ id, role }) =>
        prisma.user.create({
          data: {
            id,
            email: `monnify-${role.toLowerCase()}-${id}@example.test`,
            passwordHash,
            role,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
            staffProfile: {
              create: { firstName: "Synthetic", lastName: role, branchId: null },
            },
          },
        }),
      ),
    );

    const amounts = new Map<string, bigint>();
    let providerRefundReference = "";
    const provider: PaymentProviderPort = {
      async initialize(command) {
        amounts.set(command.reference, command.amountKobo);
        return {
          authorizationUrl: `https://checkout.monnify.com/pay/${command.reference}`,
          accessCode: `MNFY|${command.reference}`,
          providerReference: command.reference,
          authorizationExpiresAt: new Date(Date.now() + 40 * 60_000),
        };
      },
      async verify(reference) {
        return {
          reference,
          gatewayTransactionId: `MNFY|${reference}`,
          status: "success",
          amountKobo: amounts.get(reference)!,
          currency: "NGN",
          paidAt: new Date(),
          providerFeeKobo: 100n,
          method: "account_transfer",
        };
      },
      async refund(command) {
        providerRefundReference = command.refundReference;
        return { providerRefundId: command.refundReference, status: "PENDING" };
      },
      async verifyRefund(reference) {
        return {
          providerRefundId: reference,
          status: "succeeded",
          amountKobo: 3_000n,
          currency: "NGN",
        };
      },
    };
    const service = new PaymentsService(
      prisma,
      new PaymentProviderRegistry({ MONNIFY: provider }),
    );
    const order = await prisma.order.create({
      data: {
        customerId: customer.profile!.id,
        branchId: branch.id,
        orderNumber: `MN-${randomUUID()}`,
        status: "PENDING",
        currency: "NGN",
        subtotalKobo: 10_000n,
        totalKobo: 10_000n,
        customerName: "Synthetic Customer",
        customerEmail: `snapshot-${randomUUID()}@example.test`,
        customerPhone: "+2348000000000",
        paymentDueAt: new Date(Date.now() + 3_600_000),
      },
    });
    const customerActor = actor(customer.id, "CUSTOMER");
    const created = (await service.createIntent(
      customerActor,
      { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
      `intent-${randomUUID()}`,
      context,
    )) as { payment: { id: string } };
    const checkout = await service.initializeMonnify(
      customerActor,
      created.payment.id,
      "same-initialization",
      context,
    );
    const replay = await service.initializeMonnify(
      customerActor,
      created.payment.id,
      "same-initialization",
      context,
    );
    expect(replay).toMatchObject({ replayed: true, attemptId: checkout.attemptId });
    expect(checkout).not.toHaveProperty("accessCode");
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });
    expect(attempt.redactedGatewayData).not.toHaveProperty("authorizationUrl");
    expect(JSON.stringify(attempt.encryptedCheckoutState)).not.toContain(
      checkout.authorizationUrl,
    );

    const transactionEvent = {
      kind: "transaction" as const,
      eventType: "SUCCESSFUL_TRANSACTION",
      providerEventId: `SUCCESSFUL_TRANSACTION:${attempt.internalReference}`,
      reference: attempt.internalReference,
      gatewayTransactionId: `MNFY|${attempt.internalReference}`,
      status: "PAID",
      amountKobo: 10_000n,
      currency: "NGN",
      paidAt: new Date(),
      providerFeeKobo: 100n,
      method: "account_transfer",
    };
    const result = await service.ingestMonnifyWebhook(
      transactionEvent,
      "a".repeat(64),
      false,
      context,
    );
    expect(result).toMatchObject({ accepted: true, duplicate: false });
    expect(
      await service.ingestMonnifyWebhook(
        transactionEvent,
        "a".repeat(64),
        false,
        context,
      ),
    ).toMatchObject({ accepted: true, duplicate: true });
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }))
        .status,
    ).toBe("SUCCEEDED");
    expect(
      await prisma.paymentLedgerEntry.count({
        where: { paymentAttemptId: attempt.id, type: "CAPTURE" },
      }),
    ).toBe(1);
    const reconciliation = await new PaymentReconciliationWorker(
      prisma,
      new PaymentProviderRegistry({ MONNIFY: provider }),
    ).run(
      new Date(attempt.initiatedAt.getTime() - 1_000),
      new Date(Date.now() + 1_000),
      "MONNIFY",
    );
    expect(reconciliation).toMatchObject({
      provider: "MONNIFY",
      status: "MATCHED",
      differenceCount: 0,
    });

    const requested = (await service.requestRefund(
      actor(requesterId, "ADMIN"),
      {
        paymentAttemptId: attempt.id,
        amountKobo: 3_000n,
        reason: "Synthetic approved refund",
      },
      `refund-${randomUUID()}`,
      context,
    )) as { refund: { id: string } };
    await service.decideRefund(
      actor(approverId, "SUPER_ADMIN"),
      requested.refund.id,
      { decision: "APPROVED" },
      context,
    );
    await service.ingestMonnifyWebhook(
      {
        kind: "refund",
        eventType: "SUCCESSFUL_REFUND",
        providerEventId: `SUCCESSFUL_REFUND:${providerRefundReference}`,
        refundReference: providerRefundReference,
        gatewayTransactionId: `MNFY|${attempt.internalReference}`,
        status: "COMPLETED",
        amountKobo: 3_000n,
        currency: "NGN",
      },
      "b".repeat(64),
      true,
      context,
    );
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { id: requested.refund.id } }))
        .status,
    ).toBe("SUCCEEDED");
    expect(
      await prisma.paymentLedgerEntry.count({
        where: { refundId: requested.refund.id, type: "REFUND" },
      }),
    ).toBe(1);
  }, 30_000);
});
