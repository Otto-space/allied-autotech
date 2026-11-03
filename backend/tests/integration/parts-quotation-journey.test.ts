import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { orderFingerprint } from "../../src/modules/orders/orders.types.js";
import { randomUUID } from "node:crypto";
import { reviewFixtureOrderForPayment } from "../helpers/purchase-review.js";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { PartsQuotesService } from "../../src/modules/orders/parts-quotes.service.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { reviewSourceCustomer, reviewSourceFixtures } from "../helpers/review-sources.js";
import { testOwner } from "../helpers/owner.js";
const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
const quotes = new PartsQuotesService(),
  orders = new OrdersService();
async function fixture() {
  const customer = await reviewSourceCustomer();
  const sources = await reviewSourceFixtures(customer.customerId);
  const owner = await testOwner("unusable-quote-fixture");
  const actor = {
    userId: owner.id,
    email: owner.email,
    role: owner.role,
    sessionId: await paymentTestSession(owner.id, owner.role),
    mfaRequired: true,
    mfaVerifiedAt: new Date(),
  };
  const buyer: AuthenticatedActor = {
    userId: customer.user.id,
    email: customer.user.email,
    role: customer.user.role,
    sessionId: randomUUID(),
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
  const enquiry = await prisma.enquiry.create({
    data: {
      type: "PRODUCT",
      customerId: customer.customerId,
      branchId: sources.listing.branchId,
      subject: "Unlisted filter request",
      message: "Please assess this requested part.",
      name: "Fixture Customer",
      email: customer.user.email,
      phone: "08030000000",
    },
  });
  await prisma.inventory.create({
    data: {
      productId: sources.product.id,
      branchId: sources.listing.branchId,
      quantity: 5,
    },
  });
  const input = {
    expectedRevision: 0,
    productId: sources.product.id,
    quantity: 2,
    unitPriceKobo: "10000",
    notes:
      "Collection only. Payment follows final suitability and availability checks. Contact care for cancellation or refund assessment.",
  };
  return { customer, sources, actor, buyer, enquiry, input };
}
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Parts request to quoted collection order",
  () => {
    afterAll(() => prisma.$disconnect());
    it("recovers an original legacy issue receipt without rewriting its saved expiry or price", async () => {
      const f = await fixture(),
        key = randomUUID();
      const legacy = {
        ...f.input,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      };
      const original = await prisma.partsQuote.create({
        data: {
          enquiryId: f.enquiry.id,
          productId: f.input.productId,
          createdByUserId: f.actor.userId,
          revision: 1,
          productName: f.sources.product.name,
          sku: f.sources.product.sku,
          quantity: 2,
          unitPriceKobo: 10000n,
          subtotalKobo: 20000n,
          taxKobo: 1500n,
          totalKobo: 21500n,
          notes: f.input.notes,
          expiresAt: new Date(legacy.expiresAt),
          idempotencyKeyHash: hashToken("parts-quote-issue", `${f.actor.userId}:${key}`),
          requestHash: orderFingerprint({ enquiryId: f.enquiry.id, ...legacy }),
          policySnapshot: {},
        },
      });
      expect(
        await quotes.issue(f.actor, f.enquiry.id, legacy, key, context()),
      ).toMatchObject({ id: original.id });
      const saved = await prisma.partsQuote.findUniqueOrThrow({
        where: { id: original.id },
      });
      expect(saved.expiresAt).toEqual(original.expiresAt);
      expect(saved.totalKobo).toBe(original.totalKobo);
      expect(await prisma.partsQuote.count({ where: { enquiryId: f.enquiry.id } })).toBe(
        1,
      );
    });
    it("issues the approved seven-day snapshot without a client-selected expiry", async () => {
      const f = await fixture();
      const issued = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        f.input,
        randomUUID(),
        context(),
      )) as { id: string };
      const stored = await prisma.partsQuote.findUniqueOrThrow({
        where: { id: issued.id },
      });
      expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(
        7 * 86_400_000,
      );
      expect(stored.policySnapshot).toMatchObject({
        quotation: {
          approvalStatus: "APPROVED",
          settings: { validityDays: 7, shorterOverride: false },
        },
      });
    });
    it.each([1, 30])(
      "rejects an obsolete %i-day custom expiry without issuing a different offer",
      async (days) => {
        const f = await fixture();
        await expect(
          quotes.issue(
            f.actor,
            f.enquiry.id,
            {
              ...f.input,
              expiresAt: new Date(Date.now() + days * 86_400_000).toISOString(),
            },
            randomUUID(),
            context(),
          ),
        ).rejects.toThrow(/Refresh the form/);
        expect(
          await prisma.partsQuote.count({ where: { enquiryId: f.enquiry.id } }),
        ).toBe(0);
      },
    );
    it("preserves quoted prices through catalogue edits and repeated HTTP acceptance without touching the cart", async () => {
      const f = await fixture(),
        key = randomUUID();
      const issued = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        f.input,
        key,
        context(),
      )) as { id: string; revision: number };
      const stored = await prisma.partsQuote.findUniqueOrThrow({
        where: { id: issued.id },
      });
      expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(
        7 * 86_400_000,
      );
      expect(stored.policySnapshot).toMatchObject({
        quotation: {
          key: "quotation",
          settings: { validityDays: 7, shorterOverride: false },
        },
      });
      expect(
        await quotes.issue(f.actor, f.enquiry.id, f.input, key, context()),
      ).toMatchObject({ id: issued.id });
      expect(
        (await prisma.partsQuote.findUniqueOrThrow({ where: { id: issued.id } }))
          .expiresAt,
      ).toEqual(stored.expiresAt);
      await prisma.product.update({
        where: { id: f.sources.product.id },
        data: { priceKobo: 99999n, name: "Later catalogue name" },
      });
      const cart = await prisma.cart.create({
        data: {
          customerId: f.customer.customerId,
          items: { create: { productId: f.sources.product.id, quantity: 1 } },
        },
      });
      const app = createApp();
      const accept = (idempotency: string) =>
        request(app)
          .post(`/api/v1/customers/parts-quotes/${issued.id}/accept`)
          .set("Cookie", f.customer.cookie)
          .set("Origin", "http://localhost:3000")
          .set("X-CSRF-Token", f.customer.csrf)
          .set("Idempotency-Key", idempotency)
          .send({ revision: issued.revision });
      const results = await Promise.all([accept(randomUUID()), accept(randomUUID())]);
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      const order = results[0]!.body.data.order;
      expect(results[1]!.body.data.order.id).toBe(order.id);
      expect(order.items[0]).toMatchObject({
        productName: "Purchased part",
        quantity: 2,
        unitPriceKobo: "10000",
        subtotalKobo: "20000",
      });
      expect(order.totalKobo).toBe("21500");
      expect(order.paidAt).toBeNull();
      expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(1);
      expect(
        await prisma.inventoryReservation.count({ where: { referenceId: order.id } }),
      ).toBe(0);
      expect(
        await prisma.partsQuote.findUnique({ where: { id: issued.id } }),
      ).toMatchObject({ status: "ACCEPTED", orderId: order.id });
      await expect(
        quotes.issue(
          f.actor,
          f.enquiry.id,
          { ...f.input, expectedRevision: 1 },
          randomUUID(),
          context(),
        ),
      ).rejects.toThrow(/accepted quotation/i);
    });
    it("rejects stale, declined, expired and replaced quotes and keeps revisions immutable", async () => {
      const f = await fixture();
      const first = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        f.input,
        randomUUID(),
        context(),
      )) as { id: string };
      await expect(
        quotes.issue(f.actor, f.enquiry.id, f.input, randomUUID(), context()),
      ).rejects.toThrow(/changed/i);
      const second = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        { ...f.input, expectedRevision: 1, unitPriceKobo: "12000" },
        randomUUID(),
        context(),
      )) as { id: string };
      const accept = (id: string, revision: number) =>
        orders.checkout(
          f.buyer,
          { branchId: f.sources.listing.branchId, fulfillmentMethod: "COLLECTION" },
          randomUUID(),
          context(),
          { id, revision },
        );
      await expect(accept(first.id, 1)).rejects.toThrow(/replaced/i);
      await quotes.decline(f.buyer, second.id, 2, context());
      await expect(accept(second.id, 2)).rejects.toThrow(/declined/i);
      const third = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        { ...f.input, expectedRevision: 2 },
        randomUUID(),
        context(),
      )) as { id: string };
      await prisma.partsQuote.update({
        where: { id: third.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await expect(accept(third.id, 3)).rejects.toThrow(/expired/i);
      expect(
        await prisma.partsQuote.findUnique({ where: { id: first.id } }),
      ).toMatchObject({ status: "VOID", unitPriceKobo: 10000n });
    });
    it("enforces ownership, administrator authority, idempotency input and deferred stock checks", async () => {
      const f = await fixture();
      await expect(
        quotes.issue(f.buyer, f.enquiry.id, f.input, randomUUID(), context()),
      ).rejects.toThrow(/permission/i);
      const key = randomUUID();
      const quote = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        f.input,
        key,
        context(),
      )) as { id: string };
      await expect(
        quotes.issue(f.actor, f.enquiry.id, { ...f.input, quantity: 3 }, key, context()),
      ).rejects.toThrow(/different quotation/i);
      const other = await reviewSourceCustomer();
      const outsider = { ...f.buyer, userId: other.user.id, email: other.user.email };
      await expect(quotes.list(outsider, f.enquiry.id, context())).rejects.toThrow(
        /not found/i,
      );
      await expect(quotes.decline(outsider, quote.id, 1, context())).rejects.toThrow(
        /not found/i,
      );
      await expect(
        orders.checkout(
          outsider,
          { branchId: f.sources.listing.branchId, fulfillmentMethod: "COLLECTION" },
          randomUUID(),
          context(),
          { id: quote.id, revision: 1 },
        ),
      ).rejects.toThrow(/not found/i);
      await prisma.inventory.updateMany({
        where: { productId: f.sources.product.id },
        data: { quantity: 0 },
      });
      const result = (await orders.checkout(
        f.buyer,
        { branchId: f.sources.listing.branchId, fulfillmentMethod: "COLLECTION" },
        randomUUID(),
        context(),
        { id: quote.id, revision: 1 },
      )) as { order: { id: string; version: number } };
      expect(
        await prisma.partsQuote.findUnique({ where: { id: quote.id } }),
      ).toMatchObject({ status: "ACCEPTED", orderId: result.order.id });
      await expect(
        orders.transition(
          f.actor,
          result.order.id,
          {
            status: "CONFIRMED",
            expectedVersion: result.order.version,
            reason: "Compatibility reviewed for this synthetic fixture",
          },
          context(),
        ),
      ).rejects.toThrow(/Verified payment/i);
      expect(
        await prisma.inventoryReservation.count({
          where: { referenceId: result.order.id },
        }),
      ).toBe(0);
    });
    it("checks suitability and supplier availability before mocked payment, then requires actual stock on arrival", async () => {
      const f = await fixture();
      f.buyer.sessionId = await paymentTestSession(f.buyer.userId);
      const issued = (await quotes.issue(
        f.actor,
        f.enquiry.id,
        f.input,
        randomUUID(),
        context(),
      )) as { id: string };
      await prisma.inventory.updateMany({
        where: { productId: f.sources.product.id },
        data: { quantity: 0 },
      });
      const created = (await orders.checkout(
        f.buyer,
        { branchId: f.sources.listing.branchId, fulfillmentMethod: "COLLECTION" },
        randomUUID(),
        context(),
        { id: issued.id, revision: 1 },
      )) as { order: { id: string; version: number } };
      const provider: PaymentProviderPort = {
        async initialize(command) {
          return {
            authorizationUrl: `https://checkout.paystack.com/${command.reference}`,
            accessCode: "isolated-fixture",
            providerReference: command.reference,
            authorizationExpiresAt: new Date(Date.now() + 600000),
          };
        },
        async verify(reference) {
          return {
            reference,
            gatewayTransactionId: `fixture-${reference}`,
            status: "success",
            amountKobo: 21500n,
            currency: "NGN",
            paidAt: new Date(),
            providerFeeKobo: 300n,
            method: "card",
          };
        },
        async refund() {
          throw Error("Unexpected refund in this isolated scenario");
        },
      };
      const payments = new PaymentsService(
        prisma,
        new PaymentProviderRegistry({ PAYSTACK: provider }),
      );
      await reviewFixtureOrderForPayment(created.order.id, undefined, "SUPPLIER");
      const intent = (await payments.createIntent(
        f.buyer,
        { targetType: "ORDER", targetId: created.order.id, purpose: "ORDER_PAYMENT" },
        randomUUID(),
        context(),
      )) as { payment: { id: string } };
      const checkout = await payments.initializePaystack(
        f.buyer,
        intent.payment.id,
        randomUUID(),
        context(),
      );
      await payments.verifyAttempt(
        f.buyer,
        intent.payment.id,
        checkout.attemptId,
        context(),
      );
      await payments.verifyAttempt(
        f.buyer,
        intent.payment.id,
        checkout.attemptId,
        context(),
      );
      const paid = await prisma.order.findUniqueOrThrow({
        where: { id: created.order.id },
      });
      expect(paid.paidAt).not.toBeNull();
      expect(paid.status).toBe("PENDING");
      await expect(
        orders.transition(
          f.actor,
          paid.id,
          { expectedVersion: paid.version, status: "CONFIRMED" },
          context(),
        ),
      ).rejects.toThrow(/received part/i);
      await quotes.list(f.actor, f.enquiry.id, context());
      expect(
        await prisma.auditLog.count({
          where: { entityId: f.enquiry.id, action: "READ", userId: f.actor.userId },
        }),
      ).toBe(1);
      const confirmation = {
        expectedVersion: paid.version,
        status: "CONFIRMED" as const,
        reason:
          "Synthetic received part inspected against the approved specification and branch stock checked",
      };
      await expect(
        orders.transition(f.actor, paid.id, confirmation, context()),
      ).rejects.toThrow(/unavailable at the selected branch/i);
      await prisma.inventory.updateMany({
        where: { productId: f.sources.product.id },
        data: { quantity: 4 },
      });
      const confirmed = await orders.transition(
        f.actor,
        paid.id,
        confirmation,
        context(),
      );
      expect(confirmed).toMatchObject({ status: "CONFIRMED" });
      const inventory = await prisma.inventory.findFirstOrThrow({
        where: { productId: f.sources.product.id },
      });
      expect(inventory).toMatchObject({ quantity: 2, reserved: 0 });
      expect(
        await prisma.inventoryReservation.count({
          where: { referenceId: paid.id, status: "CONSUMED" },
        }),
      ).toBe(1);
      await expect(
        orders.transition(f.actor, paid.id, confirmation, context()),
      ).rejects.toThrow();
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: inventory.id } }))
          .quantity,
      ).toBe(2);
    });
  },
);
