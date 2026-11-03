import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { prisma } from "../../src/config/database.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { purchaseReviewOrderSelect } from "../../src/modules/orders/purchase-review.repository.js";
import { assertIsolatedLoopbackDatabase } from "./isolated-database.js";
import { paymentTestSession } from "./payment-session.js";
import { testOwner } from "./owner.js";

/** Simulates the buyer reading an already reviewed synthetic offer. It neither
 * approves an offer nor changes stock, pricing or the payment service input. */
export async function fixtureAcceptedReview(orderId: string) {
  await assertIsolatedLoopbackDatabase();
  return prisma.orderPurchaseReview.findFirstOrThrow({
    where: { orderId, status: "APPROVED" },
    orderBy: { revision: "desc" },
    select: { id: true, revision: true },
  });
}

/** Synthetic technical evidence for provider/lifecycle fixtures only. It never
 * changes product prices, quantities, classifications or production fitment.
 * Use the actual request/decision services rather than bypassing payment guards.
 */
export async function reviewFixtureOrderForPayment(
  orderId: string,
  guest?: { sessionToken: string; csrfToken: string },
  availability: "BRANCH_STOCK" | "SUPPLIER" = "BRANCH_STOCK",
) {
  await assertIsolatedLoopbackDatabase();
  let order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: purchaseReviewOrderSelect,
  });
  if (order.status !== "PENDING" || order.paidAt || !order.branchId)
    throw Error("Purchase-review fixture needs an unpaid pending collection order");
  if (order.items.length === 0) {
    // Older provider-only fixtures omitted product lines. Complete their synthetic
    // inputs without rewriting the immutable monetary snapshot under test. This
    // does not establish current checkout/VAT acceptance for historical records.
    const held = await prisma.inventoryReservation.findMany({
      where: {
        referenceType: "ORDER",
        referenceId: orderId,
        status: "ACTIVE",
      },
      include: { inventory: { include: { product: true } } },
    });
    if (
      held.length &&
      held.reduce(
        (sum, line) => sum + line.inventory.product.priceKobo * BigInt(line.quantity),
        0n,
      ) === order.subtotalKobo
    ) {
      await prisma.orderItem.createMany({
        data: held.map((line) => ({
          orderId,
          productId: line.inventory.productId,
          productName: line.inventory.product.name,
          sku: line.inventory.product.sku,
          quantity: line.quantity,
          unitPriceKobo: line.inventory.product.priceKobo,
          subtotalKobo: line.inventory.product.priceKobo * BigInt(line.quantity),
        })),
      });
    } else {
      if (held.length || order.subtotalKobo <= 0n)
        throw Error("Prepare explicit fixture product lines for this monetary case");
      const reference = randomUUID();
      const category = await prisma.category.create({
        data: { name: "Synthetic provider fixture", slug: reference },
      });
      const product = await prisma.product.create({
        data: {
          name: "Synthetic historical provider-test part",
          slug: reference,
          sku: reference,
          categoryId: category.id,
          priceKobo: order.subtotalKobo,
        },
      });
      await prisma.inventory.create({
        data: { productId: product.id, branchId: order.branchId, quantity: 1 },
      });
      await prisma.orderItem.create({
        data: {
          orderId,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPriceKobo: order.subtotalKobo,
          subtotalKobo: order.subtotalKobo,
        },
      });
    }
    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: purchaseReviewOrderSelect,
    });
  }
  const suffix = randomUUID();
  const owner = await testOwner("unusable-synthetic-purchase-review-fixture");
  const author = await prisma.user.create({
    data: {
      email: `purchase-evidence-author-${suffix}@example.test`,
      passwordHash: "unusable-synthetic-author-fixture",
      role: "STAFF",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      staffProfile: { create: { firstName: "Synthetic", lastName: "Technical Author" } },
    },
  });
  const make = await prisma.vehicleMake.create({
    data: { name: `Synthetic review ${suffix}`, key: suffix },
  });
  const model = await prisma.vehicleModel.create({
    data: {
      makeId: make.id,
      name: "Synthetic provider-test configuration",
      key: suffix,
      yearFrom: 2020,
      yearTo: 2030,
      sourceReference:
        "Synthetic isolated provider fixture; not a real vehicle registry entry",
    },
  });
  for (const productId of new Set(order.items.map((item) => item.productId))) {
    await prisma.productCompatibility.create({
      data: {
        productId,
        branchId: order.branchId,
        make: make.name,
        model: model.name,
        vehicleModelId: model.id,
        scope: "MODEL",
        effect: "INCLUDE",
        reviewStatus: "APPROVED",
        safetyCritical: true,
        yearFrom: 2020,
        yearTo: 2030,
        allVariantsConfirmed: true,
        requiredQualifiers: ["position", "brakeSystem"],
        position: "synthetic-front",
        brakeSystem: "synthetic-fixture-system",
        sourceReference:
          "Synthetic provider-flow evidence only; never a production compatibility approval",
        evidenceNotes:
          "Independent synthetic author/reviewer records for isolated database tests",
        createdByUserId: author.id,
        updatedByUserId: author.id,
        reviewedByUserId: owner.id,
        reviewedAt: new Date(),
      },
    });
  }
  const reviews = await prisma.orderPurchaseReview.findFirst({
    where: { orderId },
    orderBy: { revision: "desc" },
  });
  const input = {
    expectedVersion: order.version,
    expectedRevision: reviews?.revision ?? 0,
    reason: "Synthetic customer specification for isolated provider acceptance",
    lines: order.items.map((item) => ({
      orderItemId: item.id,
      selection: {
        vehicleMakeId: make.id,
        vehicleModelId: model.id,
        year: 2026,
        position: "synthetic-front",
        brakeSystem: "synthetic-fixture-system",
      },
    })),
  };
  const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
  const orders = new OrdersService();
  if (order.guestId) {
    if (!guest || order.customerId)
      throw Error("Supply the actual verified guest fixture session");
    await orders.guestRequestPurchaseReview(guest, orderId, input, context);
  } else {
    const customer = await prisma.customerProfile.findUniqueOrThrow({
      where: { id: order.customerId! },
      include: { user: true },
    });
    const actor: AuthenticatedActor = {
      userId: customer.userId,
      email: customer.user.email,
      role: "CUSTOMER",
      sessionId: await paymentTestSession(customer.userId),
      mfaRequired: false,
      mfaVerifiedAt: null,
    };
    await orders.customerRequestPurchaseReview(actor, orderId, input, context);
  }
  const current = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { version: true },
  });
  const automatic = await prisma.orderPurchaseReview.findFirstOrThrow({
    where: { orderId },
    orderBy: { revision: "desc" },
  });
  if (automatic.status === "APPROVED") return automatic;
  await orders.decidePurchaseReview(
    {
      userId: owner.id,
      email: owner.email,
      role: owner.role,
      sessionId: await paymentTestSession(owner.id, owner.role),
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    },
    orderId,
    {
      expectedVersion: current.version,
      expectedRevision: input.expectedRevision + 1,
      decision: "APPROVED",
      reason: "Synthetic final suitability and current stock review before test payment",
      availability: order.items.map((item) => ({
        orderItemId: item.id,
        evidence:
          availability === "BRANCH_STOCK"
            ? { kind: "BRANCH_STOCK" }
            : {
                kind: "SUPPLIER",
                sourceReference:
                  "Synthetic isolated supplier confirmation; not a genuine offer",
                availableUntil: new Date(Date.now() + 86400000).toISOString(),
                expectedFrom: new Date(Date.now() + 86400000).toISOString(),
                expectedTo: new Date(Date.now() + 3 * 86400000).toISOString(),
              },
      })),
    },
    context,
  );
  return prisma.orderPurchaseReview.findFirstOrThrow({
    where: { orderId },
    orderBy: { revision: "desc" },
  });
}
