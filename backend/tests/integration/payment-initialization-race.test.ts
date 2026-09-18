import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Checkout initialization races",
  () => {
    afterAll(async () => prisma.$disconnect());
    for (const verifiedStatus of ["success", "failed", "abandoned", "pending"] as const) {
      it(`preserves a provider ${verifiedStatus} result received before initialization finishes`, async () => {
        const user = await prisma.user.create({
          data: {
            email: `initialize-${randomUUID()}@example.test`,
            passwordHash: "unusable-synthetic-password",
            emailVerifiedAt: new Date(),
            profile: {
              create: {
                firstName: "Isolated",
                lastName: "Initialization",
                phone: "+2348000000000",
              },
            },
          },
          include: { profile: true },
        });
        const actor: AuthenticatedActor = {
          userId: user.id,
          email: user.email,
          role: "CUSTOMER",
          sessionId: randomUUID(),
          mfaRequired: false,
          mfaVerifiedAt: null,
        };
        const branch = await prisma.branch.create({
          data: {
            code: `IR-${randomUUID().slice(0, 8)}`,
            name: "Isolated initialization",
            address: "Test",
            city: "Test",
            state: "Test",
          },
        });
        const order = await prisma.order.create({
          data: {
            customerId: user.profile!.id,
            branchId: branch.id,
            orderNumber: `IR-${randomUUID()}`,
            subtotalKobo: 10000n,
            totalKobo: 10000n,
            customerName: "Isolated Initialization",
            customerEmail: user.email,
            customerPhone: "+2348000000000",
            paymentDueAt: new Date(Date.now() + 3600000),
          },
        });
        let service: PaymentsService;
        let calls = 0;
        const provider: PaymentProviderPort = {
          async initialize(command) {
            calls += 1;
            const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
              where: { internalReference: command.reference },
            });
            // A provider callback/reconciliation can commit before the initialize response arrives.
            await service.verifyAttempt(actor, attempt.paymentId, attempt.id, context());
            return {
              authorizationUrl: `https://checkout.paystack.com/${command.reference}`,
              accessCode: "synthetic-code",
              providerReference: command.reference,
              authorizationExpiresAt: new Date(Date.now() + 3600000),
            };
          },
          async verify(reference) {
            return {
              reference,
              gatewayTransactionId: `SYNTHETIC-${reference}`,
              status: verifiedStatus,
              amountKobo: 10000n,
              currency: "NGN",
              paidAt: verifiedStatus === "success" ? new Date() : null,
              providerFeeKobo: 0n,
              method: "card",
            };
          },
          async refund(): Promise<never> {
            throw new Error("Unexpected refund");
          },
        };
        service = new PaymentsService(
          prisma,
          new PaymentProviderRegistry({ PAYSTACK: provider }),
        );
        await service.createIntent(
          actor,
          { targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" },
          randomUUID(),
          context(),
        );
        const payment = await prisma.payment.findFirstOrThrow({
          where: { orderId: order.id },
        });
        const key = randomUUID();
        const initialization = service.initializePaystack(
          actor,
          payment.id,
          key,
          context(),
        );
        if (verifiedStatus === "pending") {
          const result = await initialization;
          expect(result.replayed).toBe(false);
          expect(
            await service.initializePaystack(actor, payment.id, key, context()),
          ).toMatchObject({ replayed: true, attemptId: result.attemptId });
        } else {
          await expect(initialization).rejects.toMatchObject({ statusCode: 409 });
        }
        const attempt = await prisma.paymentAttempt.findFirstOrThrow({
          where: { paymentId: payment.id },
        });
        expect(attempt.status).toBe(
          verifiedStatus === "success" ? "SUCCESSFUL" : verifiedStatus.toUpperCase(),
        );
        expect(attempt.encryptedCheckoutState === null).toBe(
          verifiedStatus !== "pending",
        );
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: attempt.id, type: "CAPTURE" },
          }),
        ).toBe(verifiedStatus === "success" ? 1 : 0);
        expect(
          await prisma.paymentAttempt.count({ where: { paymentId: payment.id } }),
        ).toBe(1);
        expect(calls).toBe(1);
      });
    }
  },
);
