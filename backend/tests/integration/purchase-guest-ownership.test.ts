import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { buildInvoiceSnapshot } from "../../src/modules/billing/document-snapshot.js";
import { partsQuoteView } from "../../src/modules/orders/parts-quotes.service.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { fixture, get } from "../helpers/aftercare.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

async function guestFixture() {
  const existing = await fixture();
  const beforeUsers = await prisma.user.count();
  const guest = await prisma.purchaseGuest.create({
    data: { email: existing.customer.user.email, verifiedAt: new Date() },
  });
  const orderData = {
    customerId: null,
    guestId: guest.id,
    branchId: existing.branch.id,
    orderNumber: randomUUID(),
    customerName: "Fixture Guest Buyer",
    customerEmail: guest.email,
    customerPhone: "+2348000000000",
    subtotalKobo: 30000n,
    totalKobo: 30000n,
    paymentDueAt: new Date(Date.now() + 30 * 60_000),
  };
  const order = await prisma.order.create({
    data: {
      ...orderData,
      items: {
        create: {
          productId: existing.inventory.productId,
          productName: "Fixture purchase line",
          sku: randomUUID(),
          quantity: 3,
          unitPriceKobo: 10000n,
          subtotalKobo: 30000n,
        },
      },
    },
  });
  return { ...existing, guest, guestOrder: order, orderData, beforeUsers };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "guest purchase ownership expansion",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());

    it("preserves real account rows while recording a guest purchase without a User or CustomerProfile", async () => {
      const value = await guestFixture();
      expect(await prisma.user.count()).toBe(value.beforeUsers);
      expect(value.guestOrder.customerId).toBeNull();
      expect(value.guestOrder.guestId).toBe(value.guest.id);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: value.order.id } }))
          .customerId,
      ).toBe(value.customer.user.profile!.id);
      expect(
        (
          await prisma.customerProfile.findUniqueOrThrow({
            where: { userId: value.customer.user.id },
          })
        ).id,
      ).toBe(value.customer.user.profile!.id);
    });

    it.each(["neither", "both"] as const)(
      "rejects an order with %s buyer identities",
      async (kind) => {
        const value = await guestFixture();
        await expect(
          prisma.order.create({
            data: {
              ...value.orderData,
              orderNumber: randomUUID(),
              customerId: kind === "both" ? value.customer.user.profile!.id : null,
              guestId: kind === "both" ? value.guest.id : null,
            },
          }),
        ).rejects.toThrow(/Order_exactly_one_buyer/);
      },
    );

    it("builds an immutable guest invoice from the same quantity and money snapshots", async () => {
      const value = await guestFixture();
      const source = {
        customerId: null,
        guestId: value.guest.id,
        orderId: value.guestOrder.id,
        subtotalKobo: 30000n,
        taxKobo: 0n,
        totalKobo: 30000n,
      };
      const snapshot = await prisma.$transaction((tx) =>
        buildInvoiceSnapshot(tx, source),
      );
      expect(snapshot.billTo).toEqual({
        name: "Fixture Guest Buyer",
        address: null,
        reference: value.guest.id,
      });
      expect(snapshot.lines).toEqual([
        {
          description: "Fixture purchase line",
          quantity: 3,
          unitPriceKobo: "10000",
          subtotalKobo: "30000",
        },
      ]);
      const invoice = await prisma.invoice.create({
        data: {
          ...source,
          invoiceNumber: randomUUID(),
          documentSnapshot: snapshot,
          status: "ISSUED",
          issuedAt: new Date(),
        },
      });
      const read = await get(value.admin, `/staff/invoices/${invoice.id}/document`);
      expect(read.status).toBe(200);
      expect(read.body.data.billTo).toEqual(snapshot.billTo);
      expect(read.body.data.totalKobo).toBe("30000");
      const other = await prisma.purchaseGuest.create({
        data: {
          email: `invoice-other-${randomUUID()}@example.test`,
          verifiedAt: new Date(),
        },
      });
      await expect(
        prisma.invoice.update({ where: { id: invoice.id }, data: { guestId: other.id } }),
      ).rejects.toThrow(/Guest purchase ownership is immutable/);
      // Matching verified email does not silently claim guest orders into an account.
      expect(
        (await get(value.customer, `/customers/orders/${value.guestOrder.id}`)).status,
      ).toBe(404);
      expect(
        (await get(value.customer, `/customers/invoices/${invoice.id}/document`)).status,
      ).toBe(404);
      expect(
        (await get(value.customer, `/customers/orders/${value.order.id}`)).status,
      ).toBe(200);
    });

    it("rejects mismatched invoice ownership and refuses guest booking/vehicle invoices", async () => {
      const value = await guestFixture();
      const other = await prisma.purchaseGuest.create({
        data: { email: `other-${randomUUID()}@example.test`, verifiedAt: new Date() },
      });
      const base = {
        customerId: null,
        guestId: other.id,
        orderId: value.guestOrder.id,
        subtotalKobo: 30000n,
        taxKobo: 0n,
        totalKobo: 30000n,
      };
      await expect(
        prisma.$transaction((tx) => buildInvoiceSnapshot(tx, base)),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.$transaction((tx) =>
          buildInvoiceSnapshot(tx, {
            ...base,
            customerId: value.customer.user.profile!.id,
          }),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.$transaction((tx) =>
          buildInvoiceSnapshot(tx, { ...base, orderId: null, bookingId: randomUUID() }),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.invoice.create({
          data: { ...base, guestId: null, invoiceNumber: randomUUID() },
        }),
      ).rejects.toThrow(
        /Invoice source, customer, currency, and amount snapshot must match server truth/,
      );
      await expect(
        prisma.invoice.create({
          data: {
            ...base,
            customerId: value.customer.user.profile!.id,
            invoiceNumber: randomUUID(),
          },
        }),
      ).rejects.toThrow(
        /Invoice source, customer, currency, and amount snapshot must match server truth/,
      );
      await expect(
        prisma.invoice.create({
          data: {
            ...base,
            orderId: null,
            bookingId: randomUUID(),
            invoiceNumber: randomUUID(),
          },
        }),
      ).rejects.toThrow(
        /Invoice source, customer, currency, and amount snapshot must match server truth/,
      );
    });

    it("retains guest aftercare ownership without creating a requester account or authorising money movement", async () => {
      const value = await guestFixture();
      const data = {
        orderId: value.guestOrder.id,
        guestId: value.guest.id,
        kind: "CANCELLATION",
        reason: "Synthetic cancellation intake",
        reviewReason: "Separate capable operator review required",
        items: [],
        policySnapshot: {},
      };
      const record = await prisma.orderAftercareRequest.create({ data });
      expect(record.customerId).toBeNull();
      expect(record.status).toBe("REQUESTED");
      expect(record.guestId).toBe(value.guest.id);
      expect(record.reviewedByUserId).toBeNull();
      await expect(
        prisma.orderAftercareRequest.create({ data: { ...data, guestId: null } }),
      ).rejects.toThrow(/Aftercare ownership must match the original purchase/);
      await expect(
        prisma.orderAftercareRequest.create({
          data: { ...data, customerId: value.customer.user.profile!.id },
        }),
      ).rejects.toThrow(/Aftercare ownership must match the original purchase/);
      expect(await prisma.user.count()).toBe(value.beforeUsers);
    });

    it("does not expose or retroactively assign an account quote to a guest recipient", async () => {
      const value = await guestFixture();
      const enquiry = await prisma.enquiry.create({
        data: {
          customerId: value.customer.user.profile!.id,
          branchId: value.branch.id,
          type: "PRODUCT",
          subject: "Fixture account quotation",
          message: "Synthetic product quotation request",
          name: "Fixture customer",
          email: value.customer.user.email,
        },
      });
      const line = value.order.items[0]!;
      const quote = await prisma.partsQuote.create({
        data: {
          enquiryId: enquiry.id,
          productId: line.productId,
          createdByUserId: value.admin.user.id,
          revision: 1,
          productName: line.productName,
          sku: line.sku,
          quantity: 1,
          unitPriceKobo: 10000n,
          subtotalKobo: 10000n,
          taxKobo: 0n,
          totalKobo: 10000n,
          notes: "Synthetic commercial snapshot",
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
          idempotencyKeyHash: hashToken("parts-quote-issue", randomUUID()),
          requestHash: hashToken("parts-quote-issue", randomUUID()),
          policySnapshot: {},
        },
      });
      expect(quote.guestEmail).toBeNull();
      expect(partsQuoteView(quote)).not.toHaveProperty("guestEmail");
      await expect(
        prisma.partsQuote.update({
          where: { id: quote.id },
          data: { guestEmail: value.guest.email },
        }),
      ).rejects.toThrow(/Quotation guest recipient is immutable/);
    });

    it("refuses reassignment and wrong-source aftercare at the database boundary", async () => {
      const value = await guestFixture();
      const other = await prisma.purchaseGuest.create({
        data: { email: `unrelated-${randomUUID()}@example.test`, verifiedAt: new Date() },
      });

      await expect(
        prisma.order.update({
          where: { id: value.guestOrder.id },
          data: { guestId: other.id },
        }),
      ).rejects.toThrow(/Guest purchase ownership is immutable/);
      await expect(
        prisma.orderAftercareRequest.create({
          data: {
            orderId: value.guestOrder.id,
            guestId: other.id,
            kind: "CANCELLATION",
            reason: "Synthetic wrong-owner attempt",
            reviewReason: "Must be denied",
            items: [],
            policySnapshot: {},
          },
        }),
      ).rejects.toThrow(/Aftercare ownership must match the original purchase/);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: value.guestOrder.id } }))
          .guestId,
      ).toBe(value.guest.id);
    });
  },
);
