import request from "supertest";
import { createApp } from "../../src/app.js";
import {
  purchaseCookieName,
  sessionCookieName,
} from "../../src/common/security/cookies.js";
import { FinancialDocumentsService } from "../../src/modules/billing/documents.service.js";
import { randomUUID } from "node:crypto";
import {
  fixtureAcceptedReview,
  reviewFixtureOrderForPayment,
} from "../helpers/purchase-review.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
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
import { fixture } from "../helpers/aftercare.js";
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
    await fixtureAcceptedReview(result.order.id),
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

const documents = new FinancialDocumentsService();
const app = createApp({ checkReadiness: async () => undefined });
const cookie = (f: Awaited<ReturnType<typeof setup>>) =>
  `${purchaseCookieName}=${f.guest.sessionToken}`;
async function invoice(f: Awaited<ReturnType<typeof setup>>) {
  return prisma.invoice.findFirstOrThrow({ where: { orderId: f.guestOrderId } });
}
async function pay(f: Awaited<ReturnType<typeof setup>>) {
  const attempt = await initialise(f);
  await f.payments.guestVerifyAttempt(
    f.credentials,
    f.intent.payment.id,
    attempt.attemptId,
    context(),
  );
}
describe.skipIf(process.env["RUN_DATABASE_TESTS"] !== "true")(
  "private guest financial documents",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());
    it("reads issued snapshot without granting same-email account ownership", async () => {
      const f = await setup(),
        paper = await invoice(f);
      await expect(
        documents.guestInvoice(f.guest.sessionToken, paper.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await pay(f);
      const result = await documents.guestInvoice(f.guest.sessionToken, paper.id);
      expect(result).toMatchObject({
        id: paper.id,
        status: "PAID",
        totalKobo: "21500",
        billTo: { reference: f.guest.access.guestId, name: "Synthetic Guest Payer" },
      });
      const other = await purchaseGuest();
      await expect(
        documents.guestInvoice(other.sessionToken, paper.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        documents.invoice(
          {
            userId: f.customer.user.id,
            email: f.customer.user.email,
            role: "CUSTOMER",
            sessionId: randomUUID(),
            mfaRequired: false,
            mfaVerifiedAt: null,
          },
          paper.id,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
    it("refuses a payment receipt before verified settlement", async () => {
      const f = await setup();
      await expect(
        documents.guestReceipt(f.guest.sessionToken, f.intent.payment.id),
      ).rejects.toMatchObject({ statusCode: 409 });
      const response = await request(app)
        .get(`/api/v1/purchase/payments/${f.intent.payment.id}/receipt/download`)
        .set("Cookie", cookie(f));
      expect(response.status).toBe(409);
      expect(response.headers["content-disposition"]).toBeUndefined();
    });
    it.each(["invoice", "receipt"] as const)(
      "returns private matching %s JSON and genuine PDF only to its buyer",
      async (kind) => {
        const f = await setup();
        await pay(f);
        const paper = await invoice(f),
          id = kind === "invoice" ? paper.id : f.intent.payment.id;
        const path = kind === "invoice" ? `invoices/${id}` : `payments/${id}/receipt`;
        const json = await request(app)
          .get(`/api/v1/purchase/${path}/document`)
          .set("Cookie", cookie(f));
        expect(json.status).toBe(200);
        expect(json.body.data).toMatchObject(
          kind === "invoice"
            ? {
                id,
                totalKobo: "21500",
                status: "PAID",
                receipts: [
                  {
                    paymentId: f.intent.payment.id,
                    amountKobo: "21500",
                    refundedKobo: "0",
                  },
                ],
              }
            : {
                paymentId: id,
                amountKobo: "21500",
                refundedKobo: "0",
                customerReference: f.guest.access.guestId,
              },
        );
        const pdf = await request(app)
          .get(`/api/v1/purchase/${path}/download`)
          .set("Cookie", cookie(f));
        expect(pdf.status).toBe(200);
        expect(pdf.headers).toMatchObject({
          "content-type": "application/pdf",
          "x-document-id": id,
          "x-document-type": kind,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        });
        expect(pdf.headers["content-disposition"]).toMatch(/^attachment;/);
        expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe("%PDF-");
        const other = await purchaseGuest();
        const denied = await request(app)
          .get(`/api/v1/purchase/${path}/download`)
          .set("Cookie", `${purchaseCookieName}=${other.sessionToken}`);
        expect(denied.status).toBe(404);
        expect(denied.headers["content-disposition"]).toBeUndefined();
      },
    );
    it("rejects expired/revoked proof and simultaneous account cookies", async () => {
      const f = await setup(),
        paper = await invoice(f);
      const path = `/api/v1/purchase/invoices/${paper.id}/document`;
      expect((await request(app).get(path)).status).toBe(401);
      expect(
        (
          await request(app)
            .get(path)
            .set("Cookie", `${cookie(f)}; ${sessionCookieName}=pending-account`)
        ).status,
      ).toBe(409);
      await prisma.purchaseGuestSession.update({
        where: { id: f.guest.access.sessionId },
        data: { revokedAt: new Date() },
      });
      expect((await request(app).get(path).set("Cookie", cookie(f))).status).toBe(401);
    });
    it("retains owned historical documents in limited mode and closes catalogue mode", async () => {
      const f = await setup(),
        paper = await invoice(f),
        previous = env.PUBLIC_LAUNCH_MODE;
      await pay(f);
      try {
        env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
        expect((await documents.guestInvoice(f.guest.sessionToken, paper.id)).id).toBe(
          paper.id,
        );
        env.PUBLIC_LAUNCH_MODE = "catalogue";
        await expect(
          documents.guestInvoice(f.guest.sessionToken, paper.id),
        ).rejects.toMatchObject({ statusCode: 404 });
      } finally {
        env.PUBLIC_LAUNCH_MODE = previous;
      }
    });
    it("keeps immutable invoice facts after catalogue/contact changes", async () => {
      const f = await setup(),
        paper = await invoice(f);
      await pay(f);
      const before = await documents.guestInvoice(f.guest.sessionToken, paper.id);
      await prisma.product.update({
        where: { id: f.inventory.productId },
        data: { name: "Later synthetic catalogue revision", priceKobo: 99999n },
      });
      const after = await documents.guestInvoice(f.guest.sessionToken, paper.id);
      expect(after).toEqual(before);
      expect(await prisma.user.count({ where: { email: f.guest.access.email } })).toBe(1);
    });
  },
);
