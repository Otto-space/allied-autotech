import { randomUUID } from "node:crypto";
import { reviewFixtureOrderForPayment } from "../helpers/purchase-review.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { PurchaseGuestAccessService } from "../../src/modules/orders/purchase-guest-access.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import {
  PaymentProviderRegistry,
  type OnlinePaymentProvider,
} from "../../src/providers/payments/payment-provider.registry.js";
import type {
  InitializePaymentCommand,
  PaymentProviderPort,
  VerifiedPayment,
} from "../../src/providers/payments/payment-provider.port.js";
import { fixture, get, post } from "../helpers/aftercare.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const orders = new OrdersService();
const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function setup() {
  const f = await fixture(),
    guest = await purchaseGuest(f.customer.user.email);
  const credentials = { sessionToken: guest.sessionToken, csrfToken: guest.csrfToken };
  const result = (await orders.guestCheckout(
    credentials,
    {
      branchId: f.branch.id,
      fulfillmentMethod: "COLLECTION",
      contact: { name: "Synthetic Guest Payer", phone: "+2348000000000" },
      items: [{ productId: f.inventory.productId, quantity: 2 }],
    },
    randomUUID(),
    context(),
  )) as { order: { id: string } };
  const commands: InitializePaymentCommand[] = [];
  const results = {
    status: "success" as VerifiedPayment["status"],
    amount: 21500n,
    currency: "NGN",
    verifications: 0,
  };
  const port = (provider: OnlinePaymentProvider): PaymentProviderPort => ({
    async initialize(command) {
      commands.push(command);
      return {
        authorizationUrl: `https://checkout.${provider === "PAYSTACK" ? "paystack" : "monnify"}.com/${command.reference}`,
        accessCode: "synthetic-guest-access",
        providerReference: command.reference,
        authorizationExpiresAt: new Date(Date.now() + 600_000),
      };
    },
    async verify(reference) {
      results.verifications++;
      return {
        reference,
        gatewayTransactionId: `guest-fixture-${reference}`,
        status: results.status,
        amountKobo: results.amount,
        currency: results.currency,
        paidAt: results.status === "success" ? new Date() : null,
        providerFeeKobo: 0n,
        method: "card",
      };
    },
    async refund() {
      throw Error("No external refund in guest payment fixtures");
    },
  });
  const payments = new PaymentsService(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: port("PAYSTACK"), MONNIFY: port("MONNIFY") }),
  );
  const intentKey = randomUUID();
  await reviewFixtureOrderForPayment(result.order.id, credentials);
  const intent = (await payments.guestCreateIntent(
    credentials,
    result.order.id,
    intentKey,
    context(),
  )) as { payment: { id: string; amountKobo: string }; replayed: boolean };
  return {
    ...f,
    guest,
    credentials,
    guestOrderId: result.order.id,
    payments,
    intent,
    intentKey,
    commands,
    results,
  };
}
async function initialise(
  f: Awaited<ReturnType<typeof setup>>,
  provider: OnlinePaymentProvider = "PAYSTACK",
  key = randomUUID(),
) {
  return f.payments.guestInitialize(
    f.credentials,
    f.intent.payment.id,
    key,
    context(),
    provider,
  );
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "shared guest gateway payment engine",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());

    it.each(["PAYSTACK", "MONNIFY"] as const)(
      "verifies %s funds once while keeping payment, allocation and collection readiness separate",
      async (provider) => {
        const f = await setup(),
          beforeUsers = await prisma.user.count();
        const callbackSetting =
          provider === "PAYSTACK" ? "PAYSTACK_CALLBACK_URL" : "MONNIFY_CALLBACK_URL";
        const originalCallback = env[callbackSetting];
        env[callbackSetting] = "http://localhost:3000/payments/complete";
        let initialised: Awaited<ReturnType<typeof initialise>>;
        try {
          initialised = await initialise(f, provider);
        } finally {
          env[callbackSetting] = originalCallback;
        }
        expect(f.commands).toHaveLength(1);
        expect(f.commands[0]).toMatchObject({
          email: f.guest.access.email,
          customerName: "Synthetic Guest Payer",
          amountKobo: 21500n,
          currency: "NGN",
        });
        const callback = new URL(f.commands[0]!.callbackUrl!);
        expect(callback.pathname).toBe("/purchase/complete");
        expect(callback.searchParams.get("paymentId")).toBe(f.intent.payment.id);
        expect(callback.searchParams.get("attemptId")).toBe(initialised.attemptId);
        expect(
          await prisma.order.findUnique({ where: { id: f.guestOrderId } }),
        ).toMatchObject({ paidAt: null, status: "PENDING" });
        const verified = (await f.payments.guestVerifyAttempt(
          f.credentials,
          f.intent.payment.id,
          initialised.attemptId,
          context(),
        )) as { status: string };
        expect(verified.status).toBe("SUCCEEDED");
        await f.payments.guestVerifyAttempt(
          f.credentials,
          f.intent.payment.id,
          initialised.attemptId,
          context(),
        );
        const order = await prisma.order.findUniqueOrThrow({
          where: { id: f.guestOrderId },
          include: { invoice: true },
        });
        expect(order.paidAt).not.toBeNull();
        expect(order).toMatchObject({
          status: "PENDING",
          confirmedAt: null,
          processingAt: null,
          readyAt: null,
        });
        expect(order.invoice).toMatchObject({
          status: "PAID",
          guestId: f.guest.access.guestId,
          customerId: null,
        });
        expect(
          await prisma.paymentLedgerEntry.count({
            where: { paymentAttemptId: initialised.attemptId, type: "CAPTURE" },
          }),
        ).toBe(1);
        expect(
          await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
        ).toMatchObject({ quantity: 12, reserved: 4 });
        expect(await prisma.user.count()).toBe(beforeUsers);
        expect(
          (await get(f.customer, `/customers/payments/${f.intent.payment.id}`)).status,
        ).toBe(404);
      },
    );

    it("scopes intent replay and gateway state to the current guest, not an ID or matching account email", async () => {
      const f = await setup(),
        key = f.intentKey;
      const first = (await f.payments.guestCreateIntent(
        f.credentials,
        f.guestOrderId,
        key,
        context(),
      )) as { payment: { id: string }; replayed: boolean };
      const again = (await f.payments.guestCreateIntent(
        f.credentials,
        f.guestOrderId,
        key,
        context(),
      )) as { payment: { id: string }; replayed: boolean };
      expect(first.payment.id).toBe(again.payment.id);
      expect(again.replayed).toBe(true);
      const other = await purchaseGuest(),
        credentials = { sessionToken: other.sessionToken, csrfToken: other.csrfToken };
      await expect(
        f.payments.guestGet(other.sessionToken, f.intent.payment.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        f.payments.guestInitialize(
          credentials,
          f.intent.payment.id,
          randomUUID(),
          context(),
          "PAYSTACK",
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(f.commands).toHaveLength(0);
    });

    it("refuses a normal account's payable even when that account has the verified guest's email", async () => {
      const f = await setup();
      await prisma.cart.create({
        data: {
          customerId: f.customer.user.profile!.id,
          items: { create: { productId: f.inventory.productId, quantity: 1 } },
        },
      });
      const order = await post(f.customer, "/customers/orders/checkout", {
        branchId: f.branch.id,
        fulfillmentMethod: "COLLECTION",
      });
      expect(order.status).toBe(201);
      await expect(
        f.payments.guestCreateIntent(
          f.credentials,
          order.body.data.order.id,
          randomUUID(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      await reviewFixtureOrderForPayment(order.body.data.order.id);
      const intent = await post(f.customer, "/customers/payments", {
        targetType: "ORDER",
        targetId: order.body.data.order.id,
        purpose: "ORDER_PAYMENT",
      });
      expect(intent.status).toBe(201);
      await expect(
        f.payments.guestGet(f.guest.sessionToken, intent.body.data.payment.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(f.commands).toHaveLength(0);
    });

    it("recovers an original initialized attempt without creating another charge request", async () => {
      const f = await setup(),
        key = f.intentKey;
      const first = await initialise(f, "PAYSTACK", key),
        second = await initialise(f, "PAYSTACK", key);
      expect(second).toMatchObject({
        attemptId: first.attemptId,
        authorizationUrl: first.authorizationUrl,
        replayed: true,
      });
      expect(f.commands).toHaveLength(1);
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.intent.payment.id } }),
      ).toBe(1);
    });

    it("does not initialize or verify through missing CSRF or revoked guest access", async () => {
      const f = await setup();
      await expect(
        f.payments.guestInitialize(
          { ...f.credentials, csrfToken: "" },
          f.intent.payment.id,
          randomUUID(),
          context(),
          "PAYSTACK",
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await new PurchaseGuestAccessService().revoke(
        f.guest.sessionToken,
        f.guest.csrfToken,
      );
      await expect(initialise(f)).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        f.payments.guestGet(f.guest.sessionToken, f.intent.payment.id),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(f.commands).toHaveLength(0);
      expect(f.results.verifications).toBe(0);
    });

    it.each(["amount", "currency"] as const)(
      "records %s mismatch for review without marking the guest order paid",
      async (kind) => {
        const f = await setup(),
          initialised = await initialise(f);
        if (kind === "amount") f.results.amount = 1n;
        else f.results.currency = "USD";
        const result = (await f.payments.guestVerifyAttempt(
          f.credentials,
          f.intent.payment.id,
          initialised.attemptId,
          context(),
        )) as { status: string };
        expect(result.status).toBe("REQUIRES_REVIEW");
        expect(
          await prisma.order.findUnique({ where: { id: f.guestOrderId } }),
        ).toMatchObject({ paidAt: null, status: "PENDING" });
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentId: f.intent.payment.id },
          }),
        ).toBeGreaterThan(0);
      },
    );

    it("keeps a pending provider observation separate from confirmed payment", async () => {
      const f = await setup(),
        initialised = await initialise(f);
      f.results.status = "pending";
      const result = (await f.payments.guestVerifyAttempt(
        f.credentials,
        f.intent.payment.id,
        initialised.attemptId,
        context(),
      )) as { status: string };
      expect(result.status).not.toBe("SUCCEEDED");
      expect(
        await prisma.order.findUnique({ where: { id: f.guestOrderId } }),
      ).toMatchObject({ paidAt: null });
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: initialised.attemptId, type: "CAPTURE" },
        }),
      ).toBe(0);
    });

    it("uses the existing approved late-capture reversal policy without inventing a guest refund approver", async () => {
      const f = await setup(),
        initialised = await initialise(f);
      await prisma.order.update({
        where: { id: f.guestOrderId },
        data: { paymentDueAt: new Date(Date.now() - 1_000) },
      });
      await f.payments.guestVerifyAttempt(
        f.credentials,
        f.intent.payment.id,
        initialised.attemptId,
        context(),
      );
      expect(
        await prisma.order.findUnique({ where: { id: f.guestOrderId } }),
      ).toMatchObject({ paidAt: null });
      expect(
        await prisma.refund.findFirst({
          where: { paymentAttemptId: initialised.attemptId },
        }),
      ).toMatchObject({
        authorizationKind: "SYSTEM_LATE_ORDER",
        requestedByUserId: null,
        approvedByUserId: null,
        amountKobo: 21500n,
      });
    });

    it("retains limited-release write closure for otherwise valid guest payment credentials", async () => {
      const f = await setup(),
        previous = env.PUBLIC_LAUNCH_MODE;
      try {
        env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
        await expect(initialise(f)).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          f.payments.guestCreateIntent(
            f.credentials,
            f.guestOrderId,
            randomUUID(),
            context(),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        expect(
          (
            (await f.payments.guestGet(f.guest.sessionToken, f.intent.payment.id)) as {
              id: string;
            }
          ).id,
        ).toBe(f.intent.payment.id);
      } finally {
        env.PUBLIC_LAUNCH_MODE = previous;
      }
      expect(f.commands).toHaveLength(0);
    });

    it("rejects an unapproved guest return origin before creating an attempt or calling a provider", async () => {
      const f = await setup();
      await expect(
        f.payments.guestInitialize(
          f.credentials,
          f.intent.payment.id,
          randomUUID(),
          context(),
          "PAYSTACK",
          "https://untrusted.example",
        ),
      ).rejects.toMatchObject({ statusCode: 403, code: "CSRF_INVALID" });
      expect(f.commands).toHaveLength(0);
      expect(
        await prisma.paymentAttempt.count({ where: { paymentId: f.intent.payment.id } }),
      ).toBe(0);
    });
  },
);
