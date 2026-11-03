import {
  readOrderMoneyAllocation,
  allocatedUnitRange,
} from "../../src/modules/orders/order-money-allocation.js";
import { OrderAftercareService } from "../../src/modules/orders/order-aftercare.service.js";
import { randomUUID } from "node:crypto";
import { reviewFixtureOrderForPayment } from "../helpers/purchase-review.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { PurchaseGuestAccessService } from "../../src/modules/orders/purchase-guest-access.service.js";
import { fixture, get, post } from "../helpers/aftercare.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";

const orders = new OrdersService();
const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
type Guest = Awaited<ReturnType<typeof purchaseGuest>>;
const credentials = (guest: Guest) => ({
  sessionToken: guest.sessionToken,
  csrfToken: guest.csrfToken,
});
async function setup(sameAccountEmail = false) {
  const f = await fixture();
  const guest = await purchaseGuest(sameAccountEmail ? f.customer.user.email : undefined);
  const input = {
    branchId: f.branch.id,
    fulfillmentMethod: "COLLECTION",
    contact: { name: "Synthetic Guest Buyer", phone: "+2348000000000" },
    items: [{ productId: f.inventory.productId, quantity: 2 }],
  };
  return { ...f, guest, input };
}
async function checkout(guest: Guest, input: unknown, key = randomUUID()) {
  return (await orders.guestCheckout(credentials(guest), input, key, context())) as {
    order: {
      id: string;
      totalKobo: string;
      subtotalKobo: string;
      discountAmountKobo: string;
      taxKobo: string;
      paymentDueAt: Date | null;
    };
    replayed: boolean;
  };
}
async function promotion() {
  return prisma.promotion.create({
    data: {
      name: "Synthetic one-use discount",
      code: `GUEST-${randomUUID().slice(0, 8)}`,
      discountType: "PERCENTAGE",
      percentageBasisPoints: 1000,
      usageLimit: 20,
      perCustomerLimit: 1,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
    },
  });
}
async function accountCart(f: Awaited<ReturnType<typeof setup>>, quantity = 2) {
  return prisma.cart.create({
    data: {
      customerId: f.customer.user.profile!.id,
      items: { create: { productId: f.inventory.productId, quantity } },
    },
    include: { items: true },
  });
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "shared authoritative guest checkout",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());

    it.each(["account", "guest"] as const)(
      "freezes %s order/invoice allocation and partial-review basis without repricing saved amounts",
      async (owner) => {
        const f = await setup();
        await prisma.product.update({
          where: { id: f.inventory.productId },
          data: { priceKobo: 10001n },
        });
        const offer = await promotion();
        await prisma.promotion.update({
          where: { id: offer.id },
          data: { percentageBasisPoints: 5000 },
        });
        let orderId: string;
        if (owner === "account") {
          await accountCart(f, 3);
          const response = await post(f.customer, "/customers/orders/checkout", {
            branchId: f.branch.id,
            fulfillmentMethod: "COLLECTION",
            promotionCode: offer.code,
          });
          expect(response.status, JSON.stringify(response.body)).toBe(201);
          orderId = response.body.data.order.id;
        } else {
          orderId = (
            await checkout(f.guest, {
              ...f.input,
              items: [{ productId: f.inventory.productId, quantity: 3 }],
              promotionCode: offer.code,
            })
          ).order.id;
        }
        const saved = await prisma.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { invoice: true, items: { orderBy: { id: "asc" } } },
        });
        expect(saved).toMatchObject({
          subtotalKobo: 30003n,
          discountAmountKobo: 15002n,
          taxKobo: 1125n,
          totalKobo: 16126n,
          paidAt: null,
        });
        const allocation = readOrderMoneyAllocation(saved.policySnapshot)!;
        expect(allocation.lines.map((line) => line.orderItemId)).toEqual(
          saved.items.map((line) => line.id),
        );
        expect(allocation.lines[0]).toMatchObject({
          quantity: 3,
          subtotalKobo: "30003",
          discountKobo: "15002",
          taxKobo: "1125",
          totalKobo: "16126",
        });
        expect(readOrderMoneyAllocation(saved.invoice!.policySnapshot)).toEqual(
          allocation,
        );
        expect(saved.invoice!.documentSnapshot).toMatchObject({
          lines: [{ quantity: 3, unitPriceKobo: "10001", subtotalKobo: "30003" }],
          discountKobo: "15002",
        });
        expect(
          [0, 1, 2].map(
            (offset) => allocatedUnitRange(allocation.lines[0]!, offset, 1).totalKobo,
          ),
        ).toEqual([5376n, 5375n, 5375n]);
        await prisma.product.update({
          where: { id: f.inventory.productId },
          data: { priceKobo: 20001n },
        });
        const body = {
          kind: "CANCELLATION",
          reason: "Synthetic request to review one saved quantity",
          items: [{ orderItemId: saved.items[0]!.id, quantity: 1 }],
        };
        if (owner === "account") {
          const response = await post(
            f.customer,
            `/customers/orders/${orderId}/aftercare`,
            body,
          );
          expect(response.status, JSON.stringify(response.body)).toBe(201);
        } else
          await new OrderAftercareService().guestRequest(
            credentials(f.guest),
            orderId,
            body,
            context(),
            `aftercare-v1.${Date.now()}.${randomUUID()}`,
          );
        const review = await prisma.orderAftercareRequest.findFirstOrThrow({
          where: { orderId },
        });
        expect(readOrderMoneyAllocation(review.policySnapshot)).toEqual(allocation);
        expect(review.items).toEqual(body.items);
        expect(review.status).toBe("REQUESTED");
        expect(await prisma.payment.count({ where: { orderId } })).toBe(0);
        const current = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
        expect(current.totalKobo).toBe(saved.totalKobo);
        expect(current.policySnapshot).toEqual(saved.policySnapshot);
        expect(current.paidAt).toBeNull();
      },
    );

    it("saves an unpaid owned request and holds stock only after final review without changing the matching account cart", async () => {
      const f = await setup(true),
        cart = await accountCart(f);
      const before = [await prisma.user.count(), await prisma.customerProfile.count()];
      const result = await checkout(f.guest, f.input);
      expect(result.replayed).toBe(false);
      expect(result.order).toMatchObject({
        subtotalKobo: "20000",
        discountAmountKobo: "0",
        taxKobo: "1500",
        totalKobo: "21500",
      });
      const saved = await prisma.order.findUniqueOrThrow({
        where: { id: result.order.id },
        include: { invoice: true },
      });
      expect(saved).toMatchObject({
        customerId: null,
        guestId: f.guest.access.guestId,
        customerEmail: f.guest.access.email,
        customerName: f.input.contact.name,
        paidAt: null,
        status: "PENDING",
      });
      expect(saved.invoice).toMatchObject({
        customerId: null,
        guestId: f.guest.access.guestId,
        totalKobo: 21500n,
        status: "DRAFT",
      });
      expect(saved.invoice?.documentSnapshot).toMatchObject({
        billTo: { name: f.input.contact.name, reference: f.guest.access.guestId },
        lines: [{ quantity: 2, unitPriceKobo: "10000", subtotalKobo: "20000" }],
      });
      expect([await prisma.user.count(), await prisma.customerProfile.count()]).toEqual(
        before,
      );
      expect(await prisma.cartItem.findMany({ where: { cartId: cart.id } })).toEqual(
        cart.items,
      );
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 12, reserved: 2 });
      expect(
        await prisma.inventoryReservation.findFirst({ where: { referenceId: saved.id } }),
      ).toBeNull();
      expect(
        await prisma.inventoryTransaction.findFirst({ where: { referenceId: saved.id } }),
      ).toBeNull();
      expect(result.order.paymentDueAt).toBeNull();
      await reviewFixtureOrderForPayment(result.order.id, {
        sessionToken: f.guest.sessionToken,
        csrfToken: f.guest.csrfToken,
      });
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 12, reserved: 4 });
      expect(
        await prisma.inventoryReservation.findFirst({
          where: { referenceId: saved.id, status: "ACTIVE" },
        }),
      ).toMatchObject({ customerId: null, quantity: 2 });
      expect((await get(f.customer, `/customers/orders/${saved.id}`)).status).toBe(404);
      expect(
        ((await orders.guestOrder(f.guest.sessionToken, saved.id)) as { id: string }).id,
      ).toBe(saved.id);
      await expect(
        orders.guestOrder(f.guest.sessionToken, f.order.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      const stranger = await purchaseGuest();
      await expect(
        orders.guestOrder(stranger.sessionToken, saved.id),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it("recovers one original review request across guest sessions without starting a payment window or reserving stock", async () => {
      const f = await setup(),
        key = randomUUID();
      const second = await purchaseGuest(f.guest.access.email);
      const results = await Promise.all([
        checkout(f.guest, f.input, key),
        checkout(second, f.input, key),
      ]);
      expect(new Set(results.map((r) => r.order.id)).size).toBe(1);
      expect(results.map((r) => r.replayed).sort()).toEqual([false, true]);
      expect(results[0]!.order.paymentDueAt).toEqual(results[1]!.order.paymentDueAt);
      expect(
        (
          await checkout(
            f.guest,
            {
              ...f.input,
              items: [
                {
                  ...f.input.items[0]!,
                  productId: f.input.items[0]!.productId.toUpperCase(),
                },
              ],
            },
            key,
          )
        ).replayed,
      ).toBe(true);
      await expect(
        checkout(
          f.guest,
          { ...f.input, items: [{ ...f.input.items[0]!, quantity: 3 }] },
          key,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ reserved: 2 });
      expect(
        await prisma.inventoryReservation.count({
          where: { referenceId: results[0]!.order.id },
        }),
      ).toBe(0);
      await new PurchaseGuestAccessService().revoke(
        f.guest.sessionToken,
        f.guest.csrfToken,
      );
      await expect(checkout(f.guest, f.input, key)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it("revalidates the current catalogue price before saving authoritative totals", async () => {
      const f = await setup();
      await prisma.product.update({
        where: { id: f.inventory.productId },
        data: { priceKobo: 12000n },
      });
      expect((await checkout(f.guest, f.input)).order).toMatchObject({
        subtotalKobo: "24000",
        taxKobo: "1800",
        totalKobo: "25800",
      });
    });

    it("rejects missing current CSRF and revoked access without order or stock changes", async () => {
      const f = await setup();
      const before = await prisma.order.count();
      await expect(
        orders.guestCheckout(
          { sessionToken: f.guest.sessionToken, csrfToken: "" },
          f.input,
          randomUUID(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await new PurchaseGuestAccessService().revoke(
        f.guest.sessionToken,
        f.guest.csrfToken,
      );
      await expect(checkout(f.guest, f.input)).rejects.toMatchObject({ statusCode: 401 });
      expect(await prisma.order.count()).toBe(before);
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ reserved: 2 });
    });

    it.each(["email", "customerId", "guestId", "totalKobo"])(
      "refuses body-supplied %s authority",
      async (field) => {
        const f = await setup(),
          before = await prisma.order.count();
        await expect(
          checkout(f.guest, {
            ...f.input,
            [field]: field === "email" ? f.customer.user.email : randomUUID(),
          }),
        ).rejects.toThrow();
        expect(await prisma.order.count()).toBe(before);
      },
    );

    it("rejects duplicate products, forged line prices, delivery and unsupported quantities", async () => {
      const f = await setup();
      const variants = [
        {
          ...f.input,
          items: [
            ...f.input.items,
            {
              ...f.input.items[0]!,
              productId: f.input.items[0]!.productId.toUpperCase(),
            },
          ],
        },
        { ...f.input, items: [{ ...f.input.items[0]!, unitPriceKobo: "1" }] },
        { ...f.input, fulfillmentMethod: "DELIVERY" },
        { ...f.input, items: [{ ...f.input.items[0]!, quantity: 1001 }] },
      ];
      const before = await prisma.order.count();
      for (const value of variants)
        await expect(checkout(f.guest, value)).rejects.toThrow();
      expect(await prisma.order.count()).toBe(before);
    });

    it("keeps disabled releases closed even when a guest has valid access", async () => {
      const f = await setup(),
        original = env.PUBLIC_LAUNCH_MODE;
      const before = await prisma.order.count();
      try {
        for (const mode of ["browse_enquiries", "catalogue"] as const) {
          env.PUBLIC_LAUNCH_MODE = mode;
          await expect(checkout(f.guest, f.input)).rejects.toMatchObject({
            statusCode: 409,
          });
        }
      } finally {
        env.PUBLIC_LAUNCH_MODE = original;
      }
      expect(await prisma.order.count()).toBe(before);
    });

    it("accepts unpaid requests but prevents simultaneous review approvals from holding the same final unit", async () => {
      const f = await setup(),
        second = await purchaseGuest();
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { quantity: 3 },
      });
      const input = { ...f.input, items: [{ ...f.input.items[0]!, quantity: 1 }] };
      const pending = await Promise.all([
        checkout(f.guest, input),
        checkout(second, input),
      ]);
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 3, reserved: 2 });
      const result = await Promise.allSettled([
        reviewFixtureOrderForPayment(pending[0]!.order.id, {
          sessionToken: f.guest.sessionToken,
          csrfToken: f.guest.csrfToken,
        }),
        reviewFixtureOrderForPayment(pending[1]!.order.id, {
          sessionToken: second.sessionToken,
          csrfToken: second.csrfToken,
        }),
      ]);
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
      const denied = result.find((r) => r.status === "rejected");
      if (denied?.status === "rejected")
        expect(denied.reason).toMatchObject({ statusCode: 409 });
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 3, reserved: 3 });
    });

    it("shares per-customer promotion use across an account and a verified guest with the same email", async () => {
      const f = await setup(true);
      await accountCart(f);
      const offer = await promotion();
      const original = await post(f.customer, "/customers/orders/checkout", {
        branchId: f.branch.id,
        fulfillmentMethod: "COLLECTION",
        promotionCode: offer.code,
      });
      expect(original.status).toBe(201);
      expect(original.body.data.order).toMatchObject({
        discountAmountKobo: "2000",
        taxKobo: "1350",
        totalKobo: "19350",
      });
      await expect(
        checkout(f.guest, { ...f.input, promotionCode: offer.code }),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.promotionUsage.count({ where: { promotionId: offer.id } }),
      ).toBe(1);
    });

    it("does not reset promotion use when a guest later checks out through their matching account", async () => {
      const f = await setup(true);
      await accountCart(f);
      const offer = await promotion();
      expect(
        (await checkout(f.guest, { ...f.input, promotionCode: offer.code })).order,
      ).toMatchObject({
        discountAmountKobo: "2000",
        taxKobo: "1350",
        totalKobo: "19350",
      });
      const account = await post(f.customer, "/customers/orders/checkout", {
        branchId: f.branch.id,
        fulfillmentMethod: "COLLECTION",
        promotionCode: offer.code,
      });
      expect(account.status).toBe(409);
      expect(
        await prisma.promotionUsage.count({ where: { promotionId: offer.id } }),
      ).toBe(1);
    });

    it("serializes simultaneous account/guest claims on the same one-use promotion", async () => {
      const f = await setup(true);
      await accountCart(f);
      const offer = await promotion();
      // Disjoint stock locks make the promotion lock responsible for serialising
      // these mixed-owner requests, rather than incidental inventory contention.
      const originalProduct = await prisma.product.findUniqueOrThrow({
        where: { id: f.inventory.productId },
      });
      const parallelProduct = await prisma.product.create({
        data: {
          categoryId: originalProduct.categoryId,
          name: "Synthetic parallel coupon product",
          slug: randomUUID(),
          sku: randomUUID(),
          priceKobo: 10000n,
        },
      });
      await prisma.inventory.create({
        data: { branchId: f.branch.id, productId: parallelProduct.id, quantity: 10 },
      });
      const guest = checkout(f.guest, {
        ...f.input,
        items: [{ productId: parallelProduct.id, quantity: 2 }],
        promotionCode: offer.code,
      }).then(
        () => 201,
        (error: { statusCode?: number }) => error.statusCode,
      );
      const account = post(f.customer, "/customers/orders/checkout", {
        branchId: f.branch.id,
        fulfillmentMethod: "COLLECTION",
        promotionCode: offer.code,
      }).then((r) => r.status);
      expect((await Promise.all([guest, account])).sort()).toEqual([201, 409]);
      expect(
        await prisma.promotionUsage.count({ where: { promotionId: offer.id } }),
      ).toBe(1);
    });
  },
);
