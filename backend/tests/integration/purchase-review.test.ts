import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { assertReviewedPurchasePayable } from "../../src/modules/orders/purchase-review-payable.js";
import {
  recordPurchaseRequirements,
  decidePurchaseReview,
  assertReviewCanChange,
  tryAutomaticPurchaseReview,
} from "../../src/modules/orders/purchase-review.service.js";
import { lockPurchaseReviewOrder } from "../../src/modules/orders/purchase-review.repository.js";
import { purchaseRequirementsSchema } from "../../src/modules/orders/purchase-review.schemas.js";
import { purchasePayableFingerprint } from "../../src/modules/orders/purchase-review.engine.js";
import {
  loadPurchaseFitment,
  purchaseReviewOrderSelect,
} from "../../src/modules/orders/purchase-review.repository.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import { testOwner } from "../helpers/owner.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
import { purchaseCookieName } from "../../src/common/security/cookies.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated pre-payment purchase review",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const suffix = randomUUID();
      const buyer = await reviewSourceCustomer();
      const reviewer = await testOwner("unusable-synthetic-review-fixture");
      const author = await prisma.user.create({
        data: {
          email: `review-author-${suffix}@example.test`,
          passwordHash: "unusable-synthetic-author-fixture",
          role: "STAFF",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          staffProfile: { create: { firstName: "Synthetic", lastName: "Author" } },
        },
      });
      const branch = await prisma.branch.create({
        data: {
          code: suffix.slice(0, 10),
          name: "Synthetic review branch",
          address: "Isolated fixture",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic review category", slug: suffix },
      });
      const product = await prisma.product.create({
        data: {
          name: "Synthetic universal accessory",
          slug: suffix,
          sku: suffix,
          categoryId: category.id,
          priceKobo: 10000n,
          productType: "ACCESSORY",
        },
      });
      const rule = await prisma.productCompatibility.create({
        data: {
          productId: product.id,
          make: "Universal",
          scope: "UNIVERSAL",
          effect: "INCLUDE",
          reviewStatus: "APPROVED",
          safetyCritical: false,
          allVariantsConfirmed: true,
          sourceReference:
            "Synthetic fixture evidence; not a genuine compatibility approval",
          evidenceNotes: "Isolated PostgreSQL regression fixture only",
          reviewedAt: new Date(),
          reviewedByUserId: reviewer.id,
          createdByUserId: author.id,
          updatedByUserId: author.id,
        },
      });
      const due = new Date(Date.now() + 1800000);
      const order = await prisma.order.create({
        data: {
          customerId: buyer.customerId,
          branchId: branch.id,
          orderNumber: suffix,
          customerName: "Synthetic buyer",
          customerEmail: buyer.user.email,
          customerPhone: "08030000000",
          subtotalKobo: 10000n,
          taxKobo: 750n,
          totalKobo: 10750n,
          paymentDueAt: due,
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: 1,
              unitPriceKobo: 10000n,
              subtotalKobo: 10000n,
            },
          },
        },
        select: purchaseReviewOrderSelect,
      });
      const inventory = await prisma.inventory.create({
        data: { productId: product.id, branchId: branch.id, quantity: 1, reserved: 1 },
      });
      const reservation = await prisma.inventoryReservation.create({
        data: {
          inventoryId: inventory.id,
          customerId: buyer.customerId,
          quantity: 1,
          expiresAt: due,
          idempotencyKey: randomUUID(),
          requestHash: "a".repeat(64),
          referenceType: "ORDER",
          referenceId: order.id,
        },
      });
      const requirements = {
        lines: order.items.map((item) => ({ orderItemId: item.id, selection: null })),
      };
      const fitment = await prisma.$transaction(
        (tx) => loadPurchaseFitment(tx, order, requirements),
        { isolationLevel: "Serializable" },
      );
      const review = await prisma.orderPurchaseReview.create({
        data: { orderId: order.id, revision: 1, requirements },
      });
      const approval = {
        status: "APPROVED",
        decidedByUserId: reviewer.id,
        reason: "Synthetic approval for isolated database verification",
        decidedAt: new Date(),
        expiresAt: due,
        payableFingerprint: purchasePayableFingerprint(order),
        decisionSnapshot: {
          version: 1,
          fitment,
          availability: [
            {
              orderItemId: order.items[0]!.id,
              evidence: {
                kind: "BRANCH_STOCK",
                inventoryId: inventory.id,
                reservationId: reservation.id,
                quantity: 1,
              },
            },
          ],
        },
      };
      return { order, product, rule, review, approval, reservation, inventory, buyer };
    }
    const payable = (id: string) =>
      prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, id), {
        isolationLevel: "Serializable",
      });
    async function chosenVehicle(f: Awaited<ReturnType<typeof fixture>>, approve = true) {
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "RETIRED", version: { increment: 1 } },
      });
      const key = randomUUID();
      const make = await prisma.vehicleMake.create({
        data: { key, name: `Synthetic cart make ${key}` },
      });
      const model = await prisma.vehicleModel.create({
        data: {
          key,
          makeId: make.id,
          name: "Synthetic cart model",
          yearFrom: 2020,
          yearTo: 2030,
          sourceReference: "Synthetic isolated vehicle configuration",
        },
      });
      if (approve)
        await prisma.productCompatibility.create({
          data: {
            productId: f.product.id,
            vehicleModelId: model.id,
            make: make.name,
            model: model.name,
            scope: "MODEL",
            effect: "INCLUDE",
            reviewStatus: "APPROVED",
            allVariantsConfirmed: true,
            safetyCritical: false,
            yearFrom: 2020,
            yearTo: 2030,
            sourceReference:
              "Synthetic isolated approved vehicle-specific accessory evidence",
            evidenceNotes:
              "Independent synthetic author and reviewer confirm this isolated model and year range; not production evidence",
            createdByUserId: f.rule.createdByUserId,
            updatedByUserId: f.rule.updatedByUserId,
            reviewedByUserId: f.rule.reviewedByUserId,
            reviewedAt: new Date(),
          },
        });
      return { vehicleMakeId: make.id, vehicleModelId: model.id, year: 2026 };
    }
    it("carries the account cart vehicle through quantity edits and automatic checkout without repricing or double holding", async () => {
      const f = await fixture(),
        selection = await chosenVehicle(f);
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { quantity: 3 },
      });
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const put = (body: unknown) =>
        request(app)
          .put(`/api/v1/customers/cart/items/${f.product.id}`)
          .set("Origin", env.FRONTEND_URL)
          .set("Cookie", f.buyer.cookie)
          .set("x-csrf-token", f.buyer.csrf)
          .send(body);
      const added = await put({ quantity: 1, vehicleSelection: selection });
      expect(added.status, JSON.stringify(added.body)).toBe(200);
      const edited = await put({ quantity: 2 });
      expect(edited.status, JSON.stringify(edited.body)).toBe(200);
      expect(edited.body.data.items[0].vehicleSelection).toEqual(selection);
      const key = randomUUID();
      const checkout = () =>
        request(app)
          .post("/api/v1/customers/orders/checkout")
          .set("Origin", env.FRONTEND_URL)
          .set("Cookie", f.buyer.cookie)
          .set("x-csrf-token", f.buyer.csrf)
          .set("Idempotency-Key", key)
          .send({ branchId: f.order.branchId, fulfillmentMethod: "COLLECTION" });
      const result = await checkout();
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      const order = result.body.data.order;
      expect(order.purchaseReviews[0]).toMatchObject({
        status: "APPROVED",
        requirements: { lines: [{ orderItemId: order.items[0].id, selection }] },
      });
      expect(order.items[0].quantity).toBe(2);
      expect(order.totalKobo).toBe("21500");
      expect(order.paidAt).toBeNull();
      expect((await checkout()).body.data).toMatchObject({
        replayed: true,
        order: { id: order.id },
      });
      expect(
        await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 3, reserved: 3 });
      expect(
        await prisma.inventoryReservation.count({
          where: { referenceId: order.id, status: "ACTIVE" },
        }),
      ).toBe(1);
    });
    it("retains genuine guest vehicle details for unresolved fitment without a payment deadline or stock hold", async () => {
      const f = await fixture(),
        selection = await chosenVehicle(f, false),
        guest = await purchaseGuest();
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { quantity: 2 },
      });
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const users = await prisma.user.count();
      const result = await request(app)
        .post("/api/v1/purchase/orders")
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", `${purchaseCookieName}=${guest.sessionToken}`)
        .set("x-csrf-token", guest.csrfToken)
        .set("Idempotency-Key", randomUUID())
        .send({
          branchId: f.order.branchId,
          fulfillmentMethod: "COLLECTION",
          contact: { name: "Synthetic guest cart choice", phone: "+2348000000000" },
          items: [{ productId: f.product.id, quantity: 1, vehicleSelection: selection }],
        });
      expect(result.status, JSON.stringify(result.body)).toBe(201);
      const order = result.body.data.order;
      expect(order.purchaseReviews[0]).toMatchObject({
        status: "REQUESTED",
        requirements: { lines: [{ orderItemId: order.items[0].id, selection }] },
      });
      expect(order.paymentDueAt).toBeNull();
      expect(order.paidAt).toBeNull();
      expect(order.totalKobo).toBe("10750");
      expect(await prisma.user.count()).toBe(users);
      expect(
        await prisma.inventoryReservation.count({ where: { referenceId: order.id } }),
      ).toBe(0);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(1);
    });
    it("refuses to clear a cart whose vehicle choice changed after the customer reviewed it", async () => {
      const f = await fixture(),
        selection = await chosenVehicle(f);
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { quantity: 2 },
      });
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const put = (vehicleSelection: unknown) =>
        request(app)
          .put(`/api/v1/customers/cart/items/${f.product.id}`)
          .set("Origin", env.FRONTEND_URL)
          .set("Cookie", f.buyer.cookie)
          .set("x-csrf-token", f.buyer.csrf)
          .send({ quantity: 1, vehicleSelection });
      const first = await put(selection);
      expect(first.status).toBe(200);
      const item = first.body.data.items[0];
      expect((await put({ ...selection, year: 2027 })).status).toBe(200);
      const result = await request(app)
        .delete("/api/v1/customers/cart")
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", f.buyer.cookie)
        .set("x-csrf-token", f.buyer.csrf)
        .send({
          expectedItems: [
            {
              id: item.id,
              productId: f.product.id,
              quantity: 1,
              unitPriceKobo: item.unitPriceKobo,
              vehicleSelection: selection,
            },
          ],
        });
      expect(result.status).toBe(409);
      const row = await prisma.cartItem.findUniqueOrThrow({ where: { id: item.id } });
      expect(row.vehicleSelection).toMatchObject({ year: 2027 });
    });
    it.each(["verified", "missing-evidence", "no-stock"] as const)(
      "automatically checks %s without attributing a new human approval",
      async (state) => {
        const f = await fixture();
        await prisma.inventoryReservation.update({
          where: { id: f.reservation.id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });
        await prisma.inventory.update({
          where: { id: f.inventory.id },
          data: { reserved: 0, quantity: state === "no-stock" ? 0 : 1 },
        });
        await prisma.order.update({
          where: { id: f.order.id },
          data: { paymentDueAt: null },
        });
        if (state === "missing-evidence")
          await prisma.productCompatibility.update({
            where: { id: f.rule.id },
            data: { reviewStatus: "RETIRED", version: { increment: 1 } },
          });
        const automatic = await prisma.$transaction(
          (tx) =>
            tryAutomaticPurchaseReview(tx, f.order.id, {
              requestId: randomUUID(),
              ipAddress: null,
              userAgent: null,
            }),
          { isolationLevel: "Serializable" },
        );
        expect(automatic).toBe(state === "verified");
        const review = await prisma.orderPurchaseReview.findUniqueOrThrow({
          where: { id: f.review.id },
        });
        expect(review.decidedByUserId).toBeNull();
        expect(review.status).toBe(state === "verified" ? "APPROVED" : "REQUESTED");
        const inventory = await prisma.inventory.findUniqueOrThrow({
          where: { id: f.inventory.id },
        });
        expect(inventory.reserved).toBe(state === "verified" ? 1 : 0);
        if (state === "verified") {
          expect(review.decisionMode).toBe("AUTOMATIC");
          expect((await payable(f.order.id)).order.paidAt).toBeNull();
        } else {
          expect(
            (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } }))
              .paymentDueAt,
          ).toBeNull();
        }
      },
    );
    it("blocks payment before a final decision and allows only the evidenced held offer", async () => {
      const f = await fixture();
      await expect(payable(f.order.id)).rejects.toThrow(/review is required/);
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      expect((await payable(f.order.id)).order.totalKobo).toBe(10750n);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).paidAt,
      ).toBeNull();
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .quantity,
      ).toBe(1);
    });
    it("makes an evidenced universal accessory payable during actual account checkout", async () => {
      const f = await fixture();
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { quantity: 2 },
      });
      await prisma.cart.create({
        data: {
          customerId: f.buyer.customerId,
          items: { create: { productId: f.product.id, quantity: 1 } },
        },
      });
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const response = await request(app)
        .post("/api/v1/customers/orders/checkout")
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", f.buyer.cookie)
        .set("x-csrf-token", f.buyer.csrf)
        .set("Idempotency-Key", randomUUID())
        .send({ branchId: f.order.branchId, fulfillmentMethod: "COLLECTION" });
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      const saved = response.body.data.order;
      expect(saved.purchaseReviews[0].status).toBe("APPROVED");
      expect(saved.paidAt).toBeNull();
      const checked = await payable(saved.id);
      expect(checked.order.totalKobo).toBe(10750n);
      expect(checked.order.items[0]!.quantity).toBe(1);
      const origin = await prisma.orderPurchaseReview.findFirstOrThrow({
        where: { orderId: saved.id },
      });
      expect(origin).toMatchObject({ decisionMode: "AUTOMATIC", decidedByUserId: null });
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(2);
    });
    it("retains decided evidence and rejects update, deletion and null-filled approval", async () => {
      const f = await fixture();
      await expect(
        prisma.orderPurchaseReview.update({
          where: { id: f.review.id },
          data: { status: "APPROVED" },
        }),
      ).rejects.toThrow();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      await expect(
        prisma.orderPurchaseReview.update({
          where: { id: f.review.id },
          data: { reason: "Rewritten historical decision" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.orderPurchaseReview.delete({ where: { id: f.review.id } }),
      ).rejects.toThrow();
      expect(
        (
          await prisma.orderPurchaseReview.findUniqueOrThrow({
            where: { id: f.review.id },
          })
        ).reason,
      ).toBe(f.approval.reason);
    });
    it("revokes payability when genuine evidence is retired or replaced", async () => {
      const f = await fixture();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      expect((await payable(f.order.id)).review.id).toBe(f.review.id);
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "RETIRED", version: { increment: 1 } },
      });
      await expect(payable(f.order.id)).rejects.toThrow(
        "Vehicle details are required unless approved evidence confirms a universal accessory.",
      );
    });
    it("rejects released stock holds instead of trusting an earlier availability label", async () => {
      const f = await fixture();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      await prisma.inventoryReservation.update({
        where: { id: f.reservation.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      await expect(payable(f.order.id)).rejects.toThrow(/stock hold changed/);
    });
    it("requires a fresh offer after a catalogue price changes", async () => {
      const f = await fixture();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      await prisma.product.update({
        where: { id: f.product.id },
        data: { priceKobo: 10001n },
      });
      await expect(payable(f.order.id)).rejects.toThrow(/price changed/);
    });
    it("makes a new requirements revision invalidate the previous approval", async () => {
      const f = await fixture();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      await prisma.orderPurchaseReview.create({
        data: { orderId: f.order.id, revision: 2, requirements: f.review.requirements },
      });
      await expect(payable(f.order.id)).rejects.toThrow(/review is required/);
    });
    it("starts the payment window and stock hold only after a reviewed offer is approved", async () => {
      const f = await fixture();
      // Prepare a synthetic unheld request. This is fixture setup, not evidence
      // that the normal operator stock-release authorisation has been exercised.
      await prisma.inventoryReservation.update({
        where: { id: f.reservation.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { reserved: 0, version: { increment: 1 } },
      });
      const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
      const requirements = purchaseRequirementsSchema.parse(f.review.requirements);
      await prisma.$transaction(
        async (tx) =>
          recordPurchaseRequirements(
            tx,
            await lockPurchaseReviewOrder(tx, f.order.id),
            {
              expectedVersion: 0,
              expectedRevision: 1,
              reason: "Synthetic customer specification update",
              ...requirements,
            },
            null,
            context,
          ),
        { isolationLevel: "Serializable" },
      );
      const requested = await prisma.order.findUniqueOrThrow({
        where: { id: f.order.id },
      });
      expect(requested.paymentDueAt).toBeNull();
      expect(requested.paidAt).toBeNull();
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(0);
      const decision = {
        expectedVersion: 1,
        expectedRevision: 2,
        decision: "APPROVED" as const,
        reason: "Synthetic final suitability and availability review",
        availability: [
          {
            orderItemId: f.order.items[0]!.id,
            evidence: { kind: "BRANCH_STOCK" as const },
          },
        ],
      };
      await prisma.$transaction(
        async (tx) =>
          decidePurchaseReview(
            tx,
            await lockPurchaseReviewOrder(tx, f.order.id),
            decision,
            f.approval.decidedByUserId,
            context,
          ),
        { isolationLevel: "Serializable" },
      );
      const approved = await payable(f.order.id);
      expect(approved.review.revision).toBe(2);
      expect(approved.order.paidAt).toBeNull();
      expect(approved.order.paymentDueAt!.getTime()).toBeGreaterThan(Date.now());
      const inventory = await prisma.inventory.findUniqueOrThrow({
        where: { id: f.inventory.id },
      });
      expect(inventory.quantity).toBe(1);
      expect(inventory.reserved).toBe(1);
      await expect(
        prisma.$transaction(
          async (tx) =>
            decidePurchaseReview(
              tx,
              await lockPurchaseReviewOrder(tx, f.order.id),
              decision,
              f.approval.decidedByUserId,
              context,
            ),
          { isolationLevel: "Serializable" },
        ),
      ).rejects.toThrow(/changed/);
      expect(
        await prisma.inventoryReservation.count({
          where: { referenceId: f.order.id, referenceType: "ORDER", status: "ACTIVE" },
        }),
      ).toBe(1);
    });
    it("does not replace an offer or release stock while a payment is unresolved", async () => {
      const f = await fixture();
      await prisma.payment.create({
        data: {
          orderId: f.order.id,
          customerId: f.order.customerId,
          paymentNumber: randomUUID(),
          purpose: "ORDER_PAYMENT",
          amountKobo: f.order.totalKobo,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      await expect(
        prisma.$transaction(
          async (tx) =>
            assertReviewCanChange(tx, await lockPurchaseReviewOrder(tx, f.order.id)),
          { isolationLevel: "Serializable" },
        ),
      ).rejects.toThrow(/Resolve the existing payment/);
      expect(
        (
          await prisma.inventoryReservation.findUniqueOrThrow({
            where: { id: f.reservation.id },
          })
        ).status,
      ).toBe("ACTIVE");
      expect(
        (
          await prisma.orderPurchaseReview.findUniqueOrThrow({
            where: { id: f.review.id },
          })
        ).status,
      ).toBe("REQUESTED");
    });
    it("authorises owned customer specifications and an actual Admin review without exposing private proof", async () => {
      const f = await fixture();
      const outsider = await reviewSourceCustomer();
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const requirements = purchaseRequirementsSchema.parse(f.review.requirements);
      const path = `/api/v1/customers/orders/${f.order.id}/purchase-review`;
      const body = {
        expectedVersion: 0,
        expectedRevision: 1,
        reason: "Synthetic customer specification submitted for review",
        ...requirements,
      };
      const foreign = await request(app)
        .post(path)
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", outsider.cookie)
        .set("x-csrf-token", outsider.csrf)
        .send(body);
      expect(foreign.status, JSON.stringify(foreign.body)).toBe(404);
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(1);
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "RETIRED", version: { increment: 1 } },
      });
      const submitted = await request(app)
        .post(path)
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", f.buyer.cookie)
        .set("x-csrf-token", f.buyer.csrf)
        .send(body);
      expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
      expect(submitted.body.data.purchaseReviews).toHaveLength(1);
      expect(submitted.body.data.purchaseReviews[0]).toMatchObject({
        revision: 2,
        status: "REQUESTED",
      });
      expect(submitted.body.data.paymentDueAt).toBeNull();
      expect(
        (await prisma.inventory.findUniqueOrThrow({ where: { id: f.inventory.id } }))
          .reserved,
      ).toBe(0);
      expect(
        await prisma.inventoryTransaction.count({
          where: { referenceId: f.order.id, type: "RESERVATION_RELEASE" },
        }),
      ).toBe(1);
      const admin = await prisma.user.create({
        data: {
          email: `purchase-operator-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-admin-fixture",
          role: "ADMIN",
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
          staffProfile: { create: { firstName: "Synthetic", lastName: "Administrator" } },
        },
      });
      const actor = {
        userId: admin.id,
        email: admin.email,
        role: admin.role,
        sessionId: await paymentTestSession(admin.id, admin.role),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const orders = new OrdersService();
      const decision = {
        expectedVersion: 1,
        expectedRevision: 2,
        decision: "APPROVED",
        reason: "Synthetic final operational review against approved evidence",
        availability: [
          { orderItemId: f.order.items[0]!.id, evidence: { kind: "BRANCH_STOCK" } },
        ],
      };
      const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
      await expect(
        orders.decidePurchaseReview(
          { ...actor, mfaVerifiedAt: null },
          f.order.id,
          decision,
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "APPROVED", version: { increment: 1 } },
      });
      await orders.decidePurchaseReview(actor, f.order.id, decision, context);
      const safe = await request(app)
        .get(`/api/v1/customers/orders/${f.order.id}`)
        .set("Cookie", f.buyer.cookie);
      expect(safe.status).toBe(200);
      expect(safe.body.data.purchaseReviews[0]).toMatchObject({
        revision: 2,
        status: "APPROVED",
        availability: [{ orderItemId: f.order.items[0]!.id, kind: "BRANCH_STOCK" }],
      });
      for (const key of [
        "decisionSnapshot",
        "payableFingerprint",
        "decidedByUserId",
        "reason",
      ])
        expect(safe.body.data.purchaseReviews[0]).not.toHaveProperty(key);
      expect((await payable(f.order.id)).order.paidAt).toBeNull();
    });
    it("releases and approves one aggregated hold for configured lines while preserving another order", async () => {
      const f = await fixture();
      // Create the complete immutable two-line snapshot from the outset. Keep
      // the first order and its hold untouched to test preservation as well.
      const current = await prisma.order.create({
        data: {
          customerId: f.order.customerId,
          branchId: f.order.branchId,
          orderNumber: randomUUID(),
          customerName: "Synthetic configured-line buyer",
          customerEmail: f.buyer.user.email,
          customerPhone: "08030000000",
          subtotalKobo: 20000n,
          taxKobo: 1500n,
          totalKobo: 21500n,
          paymentDueAt: f.order.paymentDueAt,
          items: {
            create: [1, 2].map(() => ({
              productId: f.product.id,
              productName: f.product.name,
              sku: f.product.sku,
              quantity: 1,
              unitPriceKobo: 10000n,
              subtotalKobo: 10000n,
            })),
          },
        },
        select: purchaseReviewOrderSelect,
      });
      await prisma.inventory.update({
        where: { id: f.inventory.id },
        data: { quantity: 3, reserved: 3 },
      });
      await prisma.inventoryReservation.create({
        data: {
          inventoryId: f.inventory.id,
          customerId: f.order.customerId,
          quantity: 2,
          expiresAt: f.order.paymentDueAt!,
          idempotencyKey: randomUUID(),
          requestHash: "b".repeat(64),
          referenceType: "ORDER",
          referenceId: current.id,
        },
      });
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const result = await request(app)
        .post(`/api/v1/customers/orders/${current.id}/purchase-review`)
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", f.buyer.cookie)
        .set("x-csrf-token", f.buyer.csrf)
        .send({
          expectedVersion: 0,
          expectedRevision: 0,
          reason: "Synthetic configured line review update",
          lines: current.items.map((item) => ({ orderItemId: item.id, selection: null })),
        });
      expect(result.status, JSON.stringify(result.body)).toBe(200);
      const inventory = await prisma.inventory.findUniqueOrThrow({
        where: { id: f.inventory.id },
      });
      expect(inventory.quantity).toBe(3);
      expect(inventory.reserved).toBe(3);
      expect(
        (
          await prisma.inventoryReservation.findUniqueOrThrow({
            where: { id: f.reservation.id },
          })
        ).status,
      ).toBe("ACTIVE");
      const ledger = await prisma.inventoryTransaction.findMany({
        where: { referenceId: current.id, type: "RESERVATION_RELEASE" },
        orderBy: { createdAt: "asc" },
      });
      expect(ledger).toHaveLength(1);
      expect(
        ledger
          .map((entry) => [entry.reservedBefore, entry.reservedAfter])
          .sort((a, b) => a[0]! - b[0]!),
      ).toEqual([[3, 1]]);
      const automatic = await prisma.orderPurchaseReview.findFirstOrThrow({
        where: { orderId: current.id },
        orderBy: { revision: "desc" },
      });
      expect(automatic).toMatchObject({
        status: "APPROVED",
        decisionMode: "AUTOMATIC",
        decidedByUserId: null,
      });
      expect(result.body.data.purchaseReviews[0].status).toBe("APPROVED");
      const holds = await prisma.inventoryReservation.findMany({
        where: { referenceType: "ORDER", referenceId: current.id, status: "ACTIVE" },
      });
      expect(holds).toHaveLength(1);
      expect(holds[0]!.quantity).toBe(2);
      expect((await payable(current.id)).order.totalKobo).toBe(21500n);
      const after = await prisma.inventory.findUniqueOrThrow({
        where: { id: f.inventory.id },
      });
      expect(after.quantity).toBe(3);
      expect(after.reserved).toBe(3);
    });
    async function payerFixture() {
      const f = await fixture();
      const actor = {
        userId: f.buyer.user.id,
        email: f.buyer.user.email,
        role: "CUSTOMER" as const,
        sessionId: await paymentTestSession(f.buyer.user.id),
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const commands: unknown[] = [];
      const port: PaymentProviderPort = {
        async initialize(command) {
          commands.push(command);
          return {
            authorizationUrl: `https://checkout.paystack.com/${command.reference}`,
            accessCode: "synthetic-review-checkout",
            providerReference: command.reference,
            authorizationExpiresAt: new Date(Date.now() + 600000),
          };
        },
        async verify(reference) {
          return {
            reference,
            gatewayTransactionId: `synthetic-review-${reference}`,
            status: "success",
            amountKobo: f.order.totalKobo,
            currency: "NGN",
            paidAt: new Date(),
            providerFeeKobo: 0n,
            method: "card",
          };
        },
        async refund() {
          throw Error("No external refund in purchase-review fixtures");
        },
      };
      const payments = new PaymentsService(
        prisma,
        new PaymentProviderRegistry({ PAYSTACK: port }),
      );
      const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
      const intent = () =>
        payments.createIntent(
          actor,
          {
            targetType: "ORDER",
            targetId: f.order.id,
            purpose: "ORDER_PAYMENT",
            acceptedReview: { id: f.review.id, revision: f.review.revision },
          },
          randomUUID(),
          context,
        );
      return { ...f, actor, commands, payments, context, intent };
    }
    it("binds account payment creation to the displayed offer and preserves original receipt recovery", async () => {
      const f = await payerFixture();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      const app = createApp();
      const key = randomUUID();
      const body = {
        targetType: "ORDER",
        targetId: f.order.id,
        purpose: "ORDER_PAYMENT",
      };
      const send = (acceptedReview?: { id: string; revision: number }) =>
        request(app)
          .post("/api/v1/customers/payments")
          .set("Cookie", f.buyer.cookie)
          .set("x-csrf-token", f.buyer.csrf)
          .set("idempotency-key", key)
          .send({ ...body, acceptedReview });
      for (const accepted of [
        undefined,
        { id: randomUUID(), revision: 1 },
        { id: f.review.id, revision: 2 },
      ]) {
        const rejected = await send(accepted);
        expect(rejected.status, JSON.stringify(rejected.body)).toBe(409);
      }
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
      const accepted = { id: f.review.id, revision: f.review.revision };
      const created = await send(accepted);
      expect(created.status, JSON.stringify(created.body)).toBe(201);
      expect(created.body.data.replayed).toBe(false);
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "RETIRED", version: { increment: 1 } },
      });
      const recovered = await send();
      expect(recovered.status, JSON.stringify(recovered.body)).toBe(201);
      expect(recovered.body.data).toMatchObject({
        replayed: true,
        payment: { id: created.body.data.payment.id },
      });
      expect((await send(accepted)).body.data.replayed).toBe(true);
      expect((await send({ ...accepted, revision: accepted.revision + 1 })).status).toBe(
        409,
      );
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(1);
      expect(f.commands).toHaveLength(0);
    });
    it("requires approval before intent and rechecks revoked evidence before contacting a provider", async () => {
      const f = await payerFixture();
      await expect(f.intent()).rejects.toMatchObject({ statusCode: 409 });
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      const created = (await f.intent()) as { payment: { id: string } };
      const saved = await prisma.payment.findUniqueOrThrow({
        where: { id: created.payment.id },
      });
      expect(saved.policySnapshot).toMatchObject({
        purchaseReview: {
          id: f.review.id,
          revision: 1,
          payableFingerprint: f.approval.payableFingerprint,
        },
      });
      expect(created.payment).not.toHaveProperty("policySnapshot");
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "RETIRED", version: { increment: 1 } },
      });
      await expect(
        f.payments.initializePaystack(f.actor, saved.id, randomUUID(), f.context),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.commands).toHaveLength(0);
      expect(await prisma.paymentAttempt.count({ where: { paymentId: saved.id } })).toBe(
        0,
      );
    });
    it("records verified captured funds after evidence revocation and holds fulfilment for review", async () => {
      const f = await payerFixture();
      await prisma.orderPurchaseReview.update({
        where: { id: f.review.id },
        data: f.approval,
      });
      const created = (await f.intent()) as { payment: { id: string } };
      const checkout = await f.payments.initializePaystack(
        f.actor,
        created.payment.id,
        randomUUID(),
        f.context,
      );
      await prisma.productCompatibility.update({
        where: { id: f.rule.id },
        data: { reviewStatus: "RETIRED", version: { increment: 1 } },
      });
      await f.payments.verifyAttempt(
        f.actor,
        created.payment.id,
        checkout.attemptId,
        f.context,
      );
      expect(
        (await prisma.payment.findUniqueOrThrow({ where: { id: created.payment.id } }))
          .status,
      ).toBe("SUCCEEDED");
      const paidOrder = await prisma.order.findUniqueOrThrow({
        where: { id: f.order.id },
      });
      expect(paidOrder.paidAt).not.toBeNull();
      const owner = await testOwner("unusable-synthetic-review-fixture");
      await expect(
        new OrdersService().transition(
          {
            userId: owner.id,
            email: owner.email,
            role: owner.role,
            sessionId: await paymentTestSession(owner.id, owner.role),
            mfaRequired: true,
            mfaVerifiedAt: new Date(),
          },
          f.order.id,
          { expectedVersion: paidOrder.version, status: "CONFIRMED" },
          f.context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const inventory = await prisma.inventory.findUniqueOrThrow({
        where: { id: f.inventory.id },
      });
      expect(inventory.quantity).toBe(1);
      expect(inventory.reserved).toBe(1);
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: checkout.attemptId, type: "CAPTURE" },
        }),
      ).toBe(1);
    });
  },
);
