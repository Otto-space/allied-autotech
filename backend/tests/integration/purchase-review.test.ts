import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { assertReviewedPurchasePayable } from "../../src/modules/orders/purchase-review-payable.js";
import {
  recordPurchaseRequirements,
  decidePurchaseReview,
  assertReviewCanChange,
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
      return { order, product, rule, review, approval, reservation, inventory };
    }
    const payable = (id: string) =>
      prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, id), {
        isolationLevel: "Serializable",
      });
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
  },
);
