import { assertReviewedPurchasePayable } from "../../src/modules/orders/purchase-review-payable.js";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { assertReviewedPurchaseFulfilment } from "../../src/modules/orders/purchase-review-fulfilment.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testOwner } from "../helpers/owner.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";

const context = { requestId: "synthetic-order-timing", ipAddress: null, userAgent: null };
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated order-specific sourcing estimates",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    async function fixture() {
      const suffix = randomUUID(),
        owner = await testOwner("unusable-synthetic-owner"),
        buyer = await reviewSourceCustomer();
      const actor: AuthenticatedActor = {
        userId: owner.id,
        email: owner.email,
        sessionId: await paymentTestSession(owner.id, owner.role),
        role: owner.role,
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const branch = await prisma.branch.create({
        data: {
          code: suffix.slice(0, 10),
          name: "Synthetic sourcing branch",
          address: "Isolated fixture",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic parts", slug: suffix },
      });
      const product = await prisma.product.create({
        data: {
          name: "Synthetic part",
          slug: suffix,
          sku: suffix,
          categoryId: category.id,
          priceKobo: 10000n,
        },
      });
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
        include: { items: true },
      });
      const body = {
        expectedVersion: order.version,
        idempotencyKey: randomUUID(),
        lines: order.items.map((item) => ({
          orderItemId: item.id,
          sourcingStatus: "IN_TRANSIT",
          sourcingFrom: "2026-11-10T08:00:00+01:00",
          sourcingUntil: "2026-11-12T18:00:00+01:00",
          preparationMinutes: 30,
        })),
        customerNote: "Supplier reports the item is in transit.",
        reason: "Private supplier reference fixture; must stay internal",
      };
      return { actor, buyer, order, body, service: new OrdersService() };
    }
    it("records an immutable current update without changing money, stock, payment, status or readiness; exposes only safe fields", async () => {
      const f = await fixture();
      await f.service.updateTiming(f.actor, f.order.id, f.body, context);
      const saved = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
      expect(saved).toMatchObject({
        version: 1,
        status: "PENDING",
        totalKobo: f.order.totalKobo,
        paidAt: null,
        readyAt: null,
      });
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
      const view = (await f.service.customerOrder(
        { ...f.actor, userId: f.buyer.user.id, role: "CUSTOMER" },
        f.order.id,
      )) as { timingUpdates: unknown[] };
      expect(view.timingUpdates).toHaveLength(1);
      const serialized = JSON.stringify(view.timingUpdates);
      expect(serialized).toContain(f.body.customerNote);
      for (const privateValue of [
        f.body.reason,
        f.actor.userId,
        f.body.idempotencyKey,
        "requestHash",
        "performedByUserId",
      ])
        expect(serialized).not.toContain(privateValue);
      const update = await prisma.orderTimingUpdate.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderTimingUpdate.update({
          where: { id: update.id },
          data: { customerNote: "changed" },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.orderTimingUpdate.delete({ where: { id: update.id } }),
      ).rejects.toThrow();
    });
    it("replays an identical request once, refuses changed reuse and retains subsequent history", async () => {
      const f = await fixture();
      await f.service.updateTiming(f.actor, f.order.id, f.body, context);
      await f.service.updateTiming(f.actor, f.order.id, f.body, context);
      expect(
        await prisma.orderTimingUpdate.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      await expect(
        f.service.updateTiming(
          f.actor,
          f.order.id,
          { ...f.body, customerNote: "changed" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await f.service.updateTiming(
        f.actor,
        f.order.id,
        {
          ...f.body,
          expectedVersion: 1,
          idempotencyKey: randomUUID(),
          customerNote: "Later confirmed supplier update",
        },
        context,
      );
      expect(
        await prisma.orderTimingUpdate.count({ where: { orderId: f.order.id } }),
      ).toBe(2);
    });
    it("rejects stale versions, wrong item IDs and closed or actually-ready orders", async () => {
      const f = await fixture();
      for (const body of [
        { ...f.body, expectedVersion: 99 },
        { ...f.body, lines: [{ ...f.body.lines[0], orderItemId: randomUUID() }] },
      ])
        await expect(
          f.service.updateTiming(f.actor, f.order.id, body, context),
        ).rejects.toMatchObject({ statusCode: 409 });
      await prisma.order.update({
        where: { id: f.order.id },
        data: { status: "READY", readyAt: new Date() },
      });
      await expect(
        f.service.updateTiming(f.actor, f.order.id, f.body, context),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.orderTimingUpdate.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
    });
    it("rechecks current role/session/MFA and keeps customer mutation forbidden", async () => {
      const f = await fixture();
      for (const actor of [
        { ...f.actor, mfaVerifiedAt: null },
        { ...f.actor, role: "STAFF" as const },
      ])
        await expect(
          f.service.updateTiming(actor, f.order.id, f.body, context),
        ).rejects.toMatchObject({ statusCode: 403 });
      await prisma.session.update({
        where: { id: f.actor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.updateTiming(f.actor, f.order.id, f.body, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      const result = await request(createApp())
        .post(`/api/v1/admin/orders/${f.order.id}/timing`)
        .set("Origin", env.FRONTEND_URL)
        .set("Cookie", f.buyer.cookie)
        .set("x-csrf-token", f.buyer.csrf)
        .send(f.body);
      expect(result.status).toBe(403);
      expect(
        await prisma.orderTimingUpdate.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
    });
    it("serializes concurrent new updates for the same order version", async () => {
      const f = await fixture();
      const results = await Promise.allSettled([
        f.service.updateTiming(f.actor, f.order.id, f.body, context),
        f.service.updateTiming(
          f.actor,
          f.order.id,
          { ...f.body, idempotencyKey: randomUUID() },
          context,
        ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.orderTimingUpdate.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
    });
    it("holds an unavailable paid part for review without cancelling or refunding it", async () => {
      const f = await fixture();
      await f.service.updateTiming(
        f.actor,
        f.order.id,
        {
          ...f.body,
          lines: [
            {
              ...f.body.lines[0],
              sourcingStatus: "UNAVAILABLE",
              sourcingFrom: null,
              sourcingUntil: null,
            },
          ],
        },
        context,
      );
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toThrow("unavailable");
      await prisma.order.update({
        where: { id: f.order.id },
        data: { paidAt: new Date() },
      });
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchaseFulfilment(tx, f.order.id)),
      ).rejects.toThrow("unavailable");
      const held = (await f.service.staffOrder(f.actor, f.order.id, context)) as {
        allowedTransitions: string[];
      };
      expect(held.allowedTransitions).not.toContain("CONFIRMED");

      expect(
        await prisma.order.findUnique({
          where: { id: f.order.id },
          select: { status: true, totalKobo: true },
        }),
      ).toEqual({ status: "PENDING", totalKobo: 10750n });
    });
  },
);
