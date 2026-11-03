import { randomUUID } from "node:crypto";
import { reviewFixtureOrderForPayment } from "../helpers/purchase-review.js";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { decryptNotificationPayload } from "../../src/common/security/mfa-encryption.js";
import { purchaseCookieName } from "../../src/common/security/cookies.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { PartsQuotesService } from "../../src/modules/orders/parts-quotes.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { supportEmailPayloadSchema } from "../../src/modules/support/customer-email.js";
import { fixture, get } from "../helpers/aftercare.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const quotes = new PartsQuotesService(),
  orders = new OrdersService();
const ctx = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
const contact = { name: "Synthetic Guest Quotation Buyer", phone: "+2348000000000" };
async function setup() {
  const f = await fixture(),
    guest = await purchaseGuest(f.customer.user.email);
  const session = await prisma.session.findFirstOrThrow({
    where: { userId: f.admin.user.id, revokedAt: null },
  });
  const actor: AuthenticatedActor = {
    userId: f.admin.user.id,
    email: f.admin.user.email,
    role: "ADMIN",
    sessionId: session.id,
    mfaRequired: true,
    mfaVerifiedAt: session.mfaVerifiedAt,
  };
  const enquiry = await prisma.enquiry.create({
    data: {
      type: "PRODUCT",
      customerId: null,
      branchId: f.branch.id,
      name: "Synthetic quotation recipient",
      email: f.customer.user.email,
      phone: contact.phone,
      subject: "Synthetic replacement part request",
      message: "Please assess this synthetic replacement part.",
    },
  });
  const input = {
    expectedRevision: 0,
    productId: f.inventory.productId,
    quantity: 2,
    unitPriceKobo: "10000",
    notes:
      "Collection only. Final suitability and availability are reviewed before payment; collection readiness is separate.",
  };
  const credentials = { sessionToken: guest.sessionToken, csrfToken: guest.csrfToken };
  const headers = {
    Origin: "http://localhost:3000",
    Cookie: `${purchaseCookieName}=${guest.sessionToken}`,
    "X-CSRF-Token": guest.csrfToken,
  };
  return { ...f, guest, actor, enquiry, input, credentials, headers };
}
async function issue(
  f: Awaited<ReturnType<typeof setup>>,
  input = f.input,
  key = randomUUID(),
) {
  return (await quotes.issue(f.actor, f.enquiry.id, input, key, ctx())) as {
    id: string;
    revision: number;
  };
}
async function accept(
  f: Awaited<ReturnType<typeof setup>>,
  quote: { id: string; revision: number },
  key = randomUUID(),
) {
  return (await orders.guestAcceptQuote(
    f.credentials,
    quote.id,
    { revision: quote.revision, contact },
    key,
    ctx(),
  )) as { order: { id: string; totalKobo: string; version: number }; replayed: boolean };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "explicit guest-directed parts quotations",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());

    it("issues one immutable seven-day recipient snapshot and encrypted update without creating an account or claiming an existing account conversation", async () => {
      const f = await setup(),
        beforeUsers = await prisma.user.count(),
        key = randomUUID();
      const quote = await issue(f, f.input, key);
      expect((await issue(f, f.input, key)).id).toBe(quote.id);
      const listed = await request(createApp({ checkReadiness: async () => undefined }))
        .get("/api/v1/purchase/parts-quotes?limit=10")
        .set(f.headers);
      expect(listed.status).toBe(200);
      expect(listed.body.data.items[0].quotation.id).toBe(quote.id);
      const saved = await prisma.partsQuote.findUniqueOrThrow({
        where: { id: quote.id },
      });
      expect(saved.guestEmail).toBe(f.guest.access.email);
      expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBe(7 * 86_400_000);
      const emails = await prisma.outboxEvent.findMany({
        where: { aggregateType: "SupportCustomerEmail", aggregateId: f.enquiry.id },
      });
      expect(emails).toHaveLength(1);
      expect(emails[0]!.status).toBe("DEAD_LETTER"); // Delivery is deliberately disabled in this isolated test.
      const payload = supportEmailPayloadSchema.parse(
        decryptNotificationPayload(
          (
            emails[0]!.payload as unknown as {
              encrypted: Parameters<typeof decryptNotificationPayload>[0];
            }
          ).encrypted,
        ),
      );
      expect(payload).toMatchObject({
        recipient: f.guest.access.email,
        userId: null,
        title: "Your parts quotation is ready",
      });
      expect(payload.message).toContain("Total: NGN 215.00");
      expect(payload.message).toContain("An account is optional");
      expect(await prisma.user.count()).toBe(beforeUsers);
      expect(
        (await get(f.customer, `/customers/parts-quotes/enquiries/${f.enquiry.id}`))
          .status,
      ).toBe(404);
      await expect(
        prisma.partsQuote.update({
          where: { id: quote.id },
          data: { guestEmail: "other@example.test" },
        }),
      ).rejects.toThrow();
    });

    it("lists only explicit guest quotations, excluding same-email account quotations and foreign cursors", async () => {
      const f = await setup(),
        guestQuote = await issue(f);
      const accountEnquiry = await prisma.enquiry.create({
        data: {
          type: "PRODUCT",
          customerId: f.customer.user.profile!.id,
          branchId: f.branch.id,
          name: contact.name,
          email: f.guest.access.email,
          subject: "Account-owned synthetic request",
          message: "Private account conversation",
        },
      });
      const accountQuote = (await quotes.issue(
        f.actor,
        accountEnquiry.id,
        f.input,
        randomUUID(),
        ctx(),
      )) as { id: string };
      const source = await prisma.partsQuote.findUniqueOrThrow({
        where: { id: accountQuote.id },
      });
      const draft = await prisma.partsQuote.create({
        data: {
          ...source,
          id: randomUUID(),
          enquiryId: f.enquiry.id,
          guestEmail: f.guest.access.email,
          revision: 2,
          status: "DRAFT",
          idempotencyKeyHash: hashToken("parts-quote-issue", randomUUID()),
          policySnapshot: source.policySnapshot as Prisma.InputJsonValue,
        },
      });
      const result = await quotes.guestList(f.guest.sessionToken, { limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.quotation).toMatchObject({ id: guestQuote.id });
      expect(result.items[0]).not.toHaveProperty("guestEmail");
      expect(result.items[0]).not.toHaveProperty("enquiry");
      expect(result.items[0]!.collectionBranch?.id).toBe(f.branch.id);
      await expect(
        quotes.guestList(f.guest.sessionToken, { limit: 10, cursor: accountQuote.id }),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        quotes.guestList(f.guest.sessionToken, { limit: 10, cursor: draft.id }),
      ).rejects.toMatchObject({ statusCode: 404 });
      const other = await purchaseGuest();
      expect((await quotes.guestList(other.sessionToken, { limit: 10 })).items).toEqual(
        [],
      );
      await expect(
        orders.guestAcceptQuote(
          { sessionToken: other.sessionToken, csrfToken: other.csrfToken },
          guestQuote.id,
          { revision: 1, contact },
          randomUUID(),
          ctx(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("accepts concurrent requests as one unpaid guest order, with exact quoted totals and no stock allocation or account-cart mutation", async () => {
      const f = await setup(),
        quote = await issue(f);
      const cart = await prisma.cart.create({
        data: {
          customerId: f.customer.user.profile!.id,
          items: { create: { productId: f.inventory.productId, quantity: 1 } },
        },
      });
      const before = await prisma.inventory.findUniqueOrThrow({
        where: { id: f.inventory.id },
      });
      await prisma.product.update({
        where: { id: f.inventory.productId },
        data: { priceKobo: 99000n },
      });
      const results = await Promise.all([
        accept(f, quote),
        request(createApp({ checkReadiness: async () => undefined }))
          .post(`/api/v1/purchase/parts-quotes/${quote.id}/accept`)
          .set(f.headers)
          .set("Idempotency-Key", randomUUID())
          .send({ revision: quote.revision, contact })
          .then((response) => {
            expect(response.status).toBe(201);
            return response.body.data as Awaited<ReturnType<typeof accept>>;
          }),
      ]);
      expect(results[1]!.order.id).toBe(results[0]!.order.id);
      expect(results[0]!.order.totalKobo).toBe("21500");
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: results[0]!.order.id },
        include: { items: true },
      });
      expect(order).toMatchObject({
        guestId: f.guest.access.guestId,
        customerId: null,
        paidAt: null,
        status: "PENDING",
      });
      expect(order.items[0]).toMatchObject({ quantity: 2, unitPriceKobo: 10000n });
      expect(
        await prisma.inventoryReservation.count({ where: { referenceId: order.id } }),
      ).toBe(0);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(before.reserved);
      expect(await prisma.cartItem.count({ where: { cartId: cart.id } })).toBe(1);
      expect(
        (await prisma.partsQuote.findUniqueOrThrow({ where: { id: quote.id } })).orderId,
      ).toBe(order.id);
    });

    it("requires current CSRF/session and refuses client identity, quantity, amount or extra promotion before order creation", async () => {
      const f = await setup(),
        quote = await issue(f),
        app = createApp({ checkReadiness: async () => undefined });
      const path = `/api/v1/purchase/parts-quotes/${quote.id}/accept`;
      for (const extra of [
        { guestId: f.guest.access.guestId },
        { quantity: 1 },
        { totalKobo: "1" },
        { promotionCode: "ANOTHER-DISCOUNT" },
      ]) {
        const response = await request(app)
          .post(path)
          .set(f.headers)
          .set("Idempotency-Key", randomUUID())
          .send({ revision: 1, contact, ...extra });
        expect(response.status).toBe(422);
      }
      await expect(
        orders.guestAcceptQuote(
          { ...f.credentials, csrfToken: "a".repeat(43) },
          quote.id,
          { revision: 1, contact },
          randomUUID(),
          ctx(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(await prisma.order.count({ where: { partsQuote: { id: quote.id } } })).toBe(
        0,
      );
    });

    it("rejects replaced, declined and stale offers while preserving revision snapshots", async () => {
      const f = await setup(),
        first = await issue(f),
        second = await issue(f, {
          ...f.input,
          expectedRevision: 1,
          unitPriceKobo: "12000",
        });
      await expect(accept(f, first)).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        orders.guestAcceptQuote(
          f.credentials,
          second.id,
          { revision: 1, contact },
          randomUUID(),
          ctx(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const declined = await request(createApp({ checkReadiness: async () => undefined }))
        .post(`/api/v1/purchase/parts-quotes/${second.id}/decline`)
        .set(f.headers)
        .send({ revision: second.revision });
      expect(declined.status).toBe(200);
      await quotes.guestDecline(f.credentials, second.id, second.revision, ctx());
      await expect(accept(f, second)).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.partsQuote.findUnique({ where: { id: first.id } }),
      ).toMatchObject({ unitPriceKobo: 10000n, status: "VOID" });
      expect(
        await prisma.partsQuote.findUnique({ where: { id: second.id } }),
      ).toMatchObject({ unitPriceKobo: 12000n, status: "REJECTED" });
    });

    it("keeps an original acceptance receipt stable after the order exists", async () => {
      const f = await setup(),
        quote = await issue(f),
        key = randomUUID(),
        first = await accept(f, quote, key);
      expect((await accept(f, quote, key)).order.id).toBe(first.order.id);
      expect((await accept(f, quote)).order.id).toBe(first.order.id);
      await expect(issue(f, { ...f.input, expectedRevision: 1 })).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(await prisma.order.count({ where: { partsQuote: { id: quote.id } } })).toBe(
        1,
      );
    });

    it("requires a revised quotation after the collection branch changes", async () => {
      const f = await setup(),
        quote = await issue(f);
      const otherBranch = await prisma.branch.create({
        data: {
          code: randomUUID().slice(0, 8),
          name: "Other synthetic branch",
          address: "Test",
          city: "Test",
          state: "Test",
        },
      });
      await prisma.enquiry.update({
        where: { id: f.enquiry.id },
        data: { branchId: otherBranch.id },
      });
      expect(
        (await quotes.guestList(f.guest.sessionToken, {})).items[0]!.collectionBranch,
      ).toBeNull();
      await expect(accept(f, quote)).rejects.toMatchObject({ statusCode: 409 });
    });

    it("refuses issuance after issuer revocation and does not create a quote or email", async () => {
      const f = await setup();
      await prisma.session.update({
        where: { id: f.actor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(issue(f)).rejects.toMatchObject({ statusCode: 403 });
      expect(await prisma.partsQuote.count({ where: { enquiryId: f.enquiry.id } })).toBe(
        0,
      );
      expect(
        await prisma.outboxEvent.count({
          where: { aggregateType: "SupportCustomerEmail", aggregateId: f.enquiry.id },
        }),
      ).toBe(0);
    });

    it("keeps guest quote mutations closed in limited mode while preserving private reads", async () => {
      const f = await setup(),
        quote = await issue(f),
        previous = env.PUBLIC_LAUNCH_MODE;
      try {
        env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
        expect((await quotes.guestList(f.guest.sessionToken, {})).items).toHaveLength(1);
        await expect(accept(f, quote)).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          quotes.guestDecline(f.credentials, quote.id, quote.revision, ctx()),
        ).rejects.toMatchObject({ statusCode: 409 });
      } finally {
        env.PUBLIC_LAUNCH_MODE = previous;
      }
    });

    it("records final review before payment and allocates the reviewed stock once after verified payment", async () => {
      const f = await setup(),
        quote = await issue(f),
        accepted = await accept(f, quote);
      await expect(
        orders.transition(
          f.actor,
          accepted.order.id,
          {
            expectedVersion: accepted.order.version,
            status: "CONFIRMED",
            reason: "Synthetic final suitability and stock review",
          },
          ctx(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const port: PaymentProviderPort = {
        async initialize(command) {
          return {
            authorizationUrl: "https://checkout.paystack.com/synthetic-quotation",
            providerReference: command.reference,
            authorizationExpiresAt: new Date(Date.now() + 600_000),
            accessCode: "synthetic",
          };
        },
        async verify(reference) {
          return {
            reference,
            gatewayTransactionId: `synthetic-${reference}`,
            status: "success",
            amountKobo: 21500n,
            currency: "NGN",
            paidAt: new Date(),
            providerFeeKobo: 0n,
            method: "card",
          };
        },
        async refund() {
          throw Error("No external financial action in quote fixtures");
        },
      };
      const payments = new PaymentsService(
        prisma,
        new PaymentProviderRegistry({ PAYSTACK: port }),
      );
      await reviewFixtureOrderForPayment(accepted.order.id, f.credentials);
      const intent = (await payments.guestCreateIntent(
        f.credentials,
        accepted.order.id,
        randomUUID(),
        ctx(),
      )) as { payment: { id: string } };
      const initialized = await payments.guestInitialize(
        f.credentials,
        intent.payment.id,
        randomUUID(),
        ctx(),
        "PAYSTACK",
      );
      await payments.guestVerifyAttempt(
        f.credentials,
        intent.payment.id,
        initialized.attemptId,
        ctx(),
      );
      const paid = await prisma.order.findUniqueOrThrow({
        where: { id: accepted.order.id },
      });
      expect(paid.status).toBe("PENDING");
      expect(paid.paidAt).not.toBeNull();
      expect(
        await prisma.inventoryReservation.count({ where: { referenceId: paid.id } }),
      ).toBe(1);
      const review = await prisma.orderPurchaseReview.findFirstOrThrow({
        where: { orderId: paid.id },
      });
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: intent.payment.id },
      });
      expect(review.decidedAt!.getTime()).toBeLessThanOrEqual(
        payment.createdAt.getTime(),
      );
      await orders.transition(
        f.actor,
        paid.id,
        {
          expectedVersion: paid.version,
          status: "CONFIRMED",
          reason: "Synthetic final suitability and current availability review completed",
        },
        ctx(),
      );
      expect(
        await prisma.inventoryReservation.findFirst({ where: { referenceId: paid.id } }),
      ).toMatchObject({ customerId: null, quantity: 2, status: "CONSUMED" });
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 10, reserved: 2 });
      expect(await prisma.order.findUnique({ where: { id: paid.id } })).toMatchObject({
        status: "CONFIRMED",
        readyAt: null,
      });
    });

    it("refuses a synthetic historical offer whose saved seven-day expiry has passed", async () => {
      const f = await setup();
      const expiresAt = new Date(Date.now() - 86_400_000);
      // Seed a separate historical fixture, never rewrite a real issued quotation.
      const expired = await prisma.partsQuote.create({
        data: {
          enquiryId: f.enquiry.id,
          productId: f.inventory.productId,
          createdByUserId: f.actor.userId,
          guestEmail: f.guest.access.email,
          revision: 1,
          productName: "Historical synthetic part",
          sku: "HISTORICAL-TEST",
          quantity: 2,
          unitPriceKobo: 10000n,
          subtotalKobo: 20000n,
          taxKobo: 1500n,
          totalKobo: 21500n,
          notes: f.input.notes,
          createdAt: new Date(expiresAt.getTime() - 7 * 86_400_000),
          expiresAt,
          idempotencyKeyHash: hashToken("parts-quote-issue", randomUUID()),
          requestHash: "0".repeat(64),
          policySnapshot: { branchId: f.branch.id },
        },
      });
      expect(
        (await quotes.guestList(f.guest.sessionToken, {})).items[0]!.quotation,
      ).toMatchObject({ status: "EXPIRED" });
      await expect(accept(f, expired)).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.order.count({ where: { partsQuote: { id: expired.id } } }),
      ).toBe(0);
    });
  },
);
