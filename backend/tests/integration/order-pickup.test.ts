import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { prisma } from "../../src/config/database.js";
import { OrderPickupService } from "../../src/modules/orders/order-pickup.service.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import { testOwner } from "../helpers/owner.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const context = {
  requestId: "synthetic-private-pickup",
  ipAddress: null,
  userAgent: null,
};
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated durable private parts pickup",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    async function fixture(guest = false) {
      const suffix = randomUUID(),
        owner = await testOwner("unusable-pickup-owner-fixture"),
        customer = await reviewSourceCustomer();
      const actor: AuthenticatedActor = {
        userId: owner.id,
        email: owner.email,
        role: owner.role,
        sessionId: await paymentTestSession(owner.id, owner.role),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const customerActor: AuthenticatedActor = {
        userId: customer.user.id,
        email: customer.user.email,
        role: "CUSTOMER",
        sessionId: await paymentTestSession(customer.user.id),
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const access = guest ? await purchaseGuest() : null;
      const buyer = access
        ? {
            kind: "guest" as const,
            sessionToken: access.sessionToken,
            csrfToken: access.csrfToken,
          }
        : { kind: "account" as const, actor: customerActor };
      const branch = await prisma.branch.create({
        data: {
          code: suffix.slice(0, 10),
          name: "Synthetic pickup branch",
          address: "Isolated fixture",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic pickup parts", slug: suffix },
      });
      const product = await prisma.product.create({
        data: {
          categoryId: category.id,
          name: "Synthetic pickup part",
          slug: suffix,
          sku: suffix,
          priceKobo: 2000n,
        },
      });
      const now = new Date();
      const order = await prisma.order.create({
        data: {
          customerId: access ? null : customer.customerId,
          guestId: access?.access.guestId ?? null,
          branchId: branch.id,
          orderNumber: suffix,
          status: "READY",
          paidAt: now,
          readyAt: now,
          customerName: "Synthetic pickup buyer",
          customerEmail: access?.access.email ?? customer.user.email,
          customerPhone: "08030000000",
          subtotalKobo: 10000n,
          taxKobo: 750n,
          totalKobo: 10750n,
          items: {
            create: {
              productId: product.id,
              productName: product.name,
              sku: product.sku,
              quantity: 5,
              unitPriceKobo: 2000n,
              subtotalKobo: 10000n,
            },
          },
        },
        include: { items: true },
      });
      // Canonical synthetic settled-receipt state; this is not provider acceptance.
      const payment = await prisma.payment.create({
        data: {
          orderId: order.id,
          customerId: order.customerId,
          paymentNumber: suffix,
          purpose: "ORDER_PAYMENT",
          amountKobo: 10750n,
          idempotencyKeyHash: suffix.replaceAll("-", "").repeat(2),
        },
      });
      const attempt = await prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: 1,
          internalReference: suffix,
          provider: "PAYSTACK",
          status: "SUCCESSFUL",
          verificationStatus: "VERIFIED",
          amountKobo: payment.amountKobo,
          verifiedAmountKobo: payment.amountKobo,
          verifiedCurrency: "NGN",
          verifiedAt: now,
          paidAt: now,
          providerReference: suffix,
          gatewayTransactionId: suffix,
        },
      });
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCEEDED", settledAttemptId: attempt.id, succeededAt: now },
      });
      const service = new OrderPickupService(),
        lines = order.items.map((item) => ({
          orderItemId: item.id,
          quantity: item.quantity,
        }));
      const issue = (quantity = 5, expectedVersion = 0, idempotencyKey = randomUUID()) =>
        service.issue(
          buyer,
          order.id,
          { expectedVersion, idempotencyKey, lines: [{ ...lines[0], quantity }] },
          context,
        );
      async function prepared(secret: Awaited<ReturnType<typeof issue>>, quantity = 5) {
        const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
          requested = [{ ...lines[0]!, quantity }];
        const preview = await service.verify(actor, order.id, {
          expectedVersion: current.version,
          pickupCode: secret.pickupCode!,
          lines: requested,
        });
        return {
          expectedVersion: preview.version,
          claimId: preview.claimId,
          pickupCode: secret.pickupCode!,
          lines: requested,
          authorisationId: preview.authorisationId,
          financialReviewHash: preview.financialReviewHash,
          idempotencyKey: randomUUID(),
          collectorName: "Synthetic authorised collector",
          verificationNote: "Code and actual eligible goods checked at physical handover",
          physicalHandoverConfirmed: true as const,
        };
      }
      return {
        actor,
        customerActor,
        customer,
        buyer,
        access,
        branch,
        order,
        payment,
        attempt,
        lines,
        service,
        issue,
        prepared,
      };
    }
    it("issues an order-bound secret once, never redisplays it on replay or safe reads, and denies another buyer", async () => {
      const f = await fixture(),
        nonce = randomUUID(),
        secret = await f.issue(5, 0, nonce);
      expect(secret.pickupCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const stored = await prisma.orderPickupAuthorisation.findUniqueOrThrow({
        where: { id: secret.authorisationId },
      });
      expect(stored.tokenHash).not.toContain(secret.pickupCode!);
      const replay = await f.issue(5, 0, nonce);
      expect(replay.pickupCode).toBeNull();
      expect(replay.replayed).toBe(true);
      const safe = await f.service.read(f.buyer, f.order.id);
      for (const value of [
        secret.pickupCode!,
        stored.tokenHash,
        "tokenHash",
        "requestHash",
        "issuedByUserId",
      ])
        expect(JSON.stringify(safe)).not.toContain(value);
      const other = await reviewSourceCustomer();
      await expect(
        f.service.read(
          {
            kind: "account",
            actor: {
              ...f.customerActor,
              userId: other.user.id,
              sessionId: await paymentTestSession(other.user.id),
            },
          },
          f.order.id,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(
        await prisma.orderPickupAuthorisation.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
    });
    it("supports partial physical handover, consumes the code, retains exact remainder and completes only on final pickup", async () => {
      const f = await fixture(),
        secret = await f.issue(),
        body = await f.prepared(secret, 2);
      const first = await f.service.handover(f.actor, f.order.id, body, context);
      expect(first).toMatchObject({
        complete: false,
        replayed: false,
        lines: [{ orderItemId: f.lines[0]!.orderItemId, quantity: 2 }],
      });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).status,
      ).toBe("READY");
      expect((await f.service.read(f.buyer, f.order.id)).remaining).toEqual([
        { ...f.lines[0], quantity: 3 },
      ]);
      expect(
        (await f.service.handover(f.actor, f.order.id, body, context)).replayed,
      ).toBe(true);
      await expect(
        f.service.handover(
          f.actor,
          f.order.id,
          { ...body, expectedVersion: 3, idempotencyKey: randomUUID() },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const next = await f.issue(3, 3),
        final = await f.service.handover(
          f.actor,
          f.order.id,
          await f.prepared(next, 3),
          context,
        );
      expect(final.complete).toBe(true);
      const saved = await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } });
      expect(saved).toMatchObject({ status: "COMPLETED", totalKobo: 10750n });
      expect(
        await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
      ).toBe(2);
      const history = await f.service.read(f.buyer, f.order.id);
      expect(history.remaining).toEqual([]);
      expect(JSON.stringify(history)).not.toContain(body.verificationNote);
      await expect(
        prisma.orderPickupHandover.delete({ where: { id: first.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.orderPickupHandover.update({
          where: { id: first.id },
          data: { collectorName: "overwrite" },
        }),
      ).rejects.toThrow();
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(1);
    });
    it("revokes old authorisations on reissue and refuses changed replay or revoked codes", async () => {
      const f = await fixture(),
        secret = await f.issue(),
        next = await f.issue(5, 1);
      expect(
        (
          await prisma.orderPickupAuthorisation.findUniqueOrThrow({
            where: { id: secret.authorisationId },
          })
        ).revokedAt,
      ).not.toBeNull();
      await expect(
        f.service.verify(f.actor, f.order.id, {
          expectedVersion: 2,
          pickupCode: secret.pickupCode!,
          lines: f.lines,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
      await f.service.revoke(
        f.buyer,
        f.order.id,
        {
          expectedVersion: 2,
          authorisationId: next.authorisationId,
          reason: "Collector changed",
        },
        context,
      );
      await expect(
        f.service.verify(f.actor, f.order.id, {
          expectedVersion: 3,
          pickupCode: next.pickupCode!,
          lines: f.lines,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("serializes concurrent handovers and permits one physical event only", async () => {
      const f = await fixture(),
        secret = await f.issue(),
        body = await f.prepared(secret);
      const results = await Promise.allSettled([
        f.service.handover(f.actor, f.order.id, body, context),
        f.service.handover(
          f.actor,
          f.order.id,
          { ...body, idempotencyKey: randomUUID() },
          context,
        ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
    });
    it("claims one review across sessions, blocks replacement and requires explicit safe resolution", async () => {
      const f = await fixture(),
        secret = await f.issue();
      const other = {
        ...f.actor,
        sessionId: await paymentTestSession(f.actor.userId, f.actor.role),
      };
      const input = {
        expectedVersion: 1,
        pickupCode: secret.pickupCode!,
        lines: f.lines,
      };
      const results = await Promise.allSettled([
        f.service.verify(f.actor, f.order.id, input),
        f.service.verify(other, f.order.id, input),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const winnerIndex = results.findIndex((r) => r.status === "fulfilled");
      const winner = winnerIndex === 0 ? f.actor : other;
      const loser = winnerIndex === 0 ? other : f.actor;
      const preview = await f.service.verify(winner, f.order.id, input);
      expect(preview.version).toBe(2);
      expect(
        await prisma.orderPickupClaim.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      await expect(f.issue(5, 2)).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        f.service.revoke(
          f.buyer,
          f.order.id,
          {
            expectedVersion: 2,
            authorisationId: secret.authorisationId,
            reason: "Collector changed",
          },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const body = {
        expectedVersion: preview.version,
        claimId: preview.claimId,
        authorisationId: preview.authorisationId,
        financialReviewHash: preview.financialReviewHash,
        pickupCode: secret.pickupCode!,
        lines: f.lines,
        idempotencyKey: randomUUID(),
        collectorName: "Synthetic collector",
        verificationNote: "Actual goods confirmed in isolated fixture",
        physicalHandoverConfirmed: true,
      };
      await expect(
        f.service.handover(loser, f.order.id, body, context),
      ).rejects.toMatchObject({ statusCode: 409 });
      const cancellation = {
        expectedVersion: 2,
        claimId: preview.claimId,
        reason: "Goods remain in the workshop; no physical handover occurred",
        goodsNotHandedOverConfirmed: true,
      };
      expect(() =>
        f.service.cancelClaim(
          winner,
          f.order.id,
          { ...cancellation, goodsNotHandedOverConfirmed: false },
          context,
        ),
      ).toThrow();
      await f.service.cancelClaim(winner, f.order.id, cancellation, context);
      expect(
        await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      expect((await f.service.read(f.buyer, f.order.id)).remaining).toEqual(f.lines);
      expect(
        (
          await prisma.orderPickupAuthorisation.findUniqueOrThrow({
            where: { id: secret.authorisationId },
          })
        ).revokedAt,
      ).not.toBeNull();
      expect((await f.issue(5, 3)).pickupCode).toBeTruthy();
    });
    it("does not let a direct status update, unresolved payment or changed proof bypass collection checks", async () => {
      const f = await fixture();
      await expect(
        new OrdersService().transition(
          f.actor,
          f.order.id,
          { expectedVersion: 0, status: "COMPLETED" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.order.update({ where: { id: f.order.id }, data: { status: "COMPLETED" } }),
      ).rejects.toThrow();
      const secret = await f.issue(),
        body = await f.prepared(secret);
      await expect(
        f.service.handover(
          f.actor,
          f.order.id,
          { ...body, financialReviewHash: "a".repeat(64) },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await prisma.payment.create({
        data: {
          orderId: f.order.id,
          customerId: f.order.customerId,
          paymentNumber: randomUUID(),
          purpose: "ORDER_PAYMENT",
          amountKobo: 10750n,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
        },
      });
      await expect(
        f.service.handover(f.actor, f.order.id, body, context),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        (
          await prisma.orderPickupAuthorisation.findUniqueOrThrow({
            where: { id: secret.authorisationId },
          })
        ).consumedAt,
      ).toBeNull();
    });
    it("requires current account access, MFA and actual Staff branch scope", async () => {
      const f = await fixture();
      await expect(
        f.service.readStaff({ ...f.actor, mfaVerifiedAt: null }, f.order.id, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      const staff = await prisma.user.create({
        data: {
          email: `pickup-staff-${randomUUID()}@example.test`,
          passwordHash: "unusable-pickup-fixture",
          role: "STAFF",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: { firstName: "Synthetic", lastName: "Staff", branchId: f.branch.id },
          },
        },
      });
      const actor = {
        ...f.actor,
        userId: staff.id,
        email: staff.email,
        role: "STAFF" as const,
        sessionId: await paymentTestSession(staff.id, "STAFF"),
      };
      expect((await f.service.readStaff(actor, f.order.id, context)).orderId).toBe(
        f.order.id,
      );
      await prisma.staffProfile.update({
        where: { userId: staff.id },
        data: { branchId: null },
      });
      await expect(f.service.readStaff(actor, f.order.id, context)).rejects.toMatchObject(
        { statusCode: 403 },
      );
      await prisma.session.update({
        where: { id: f.customerActor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(f.issue()).rejects.toMatchObject({ statusCode: 403 });
    });
    it("keeps guest collection access private and separate from customer accounts", async () => {
      const f = await fixture(true),
        secret = await f.issue();
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const { purchaseCookieName } = await import("../../src/common/security/cookies.js");
      const read = await request(app)
        .get(`/api/v1/purchase/orders/${f.order.id}/pickup`)
        .set("Cookie", `${purchaseCookieName}=${f.access!.sessionToken}`);
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(JSON.stringify(read.body)).not.toContain(secret.pickupCode!);
      const account = await request(app)
        .get(`/api/v1/customers/orders/${f.order.id}/pickup`)
        .set("Cookie", f.customer.cookie);
      expect(account.status).toBe(404);
      const mixed = await request(app)
        .get(`/api/v1/purchase/orders/${f.order.id}/pickup`)
        .set(
          "Cookie",
          `${purchaseCookieName}=${f.access!.sessionToken}; ${f.customer.cookie}`,
        );
      expect(mixed.status).toBe(409);
    });
    it("enforces HTTP CSRF/current MFA and explicit physical-handover acknowledgement", async () => {
      const f = await fixture(),
        app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const url = `/api/v1/customers/orders/${f.order.id}/pickup`;
      const body = { expectedVersion: 0, idempotencyKey: randomUUID(), lines: f.lines };
      const missing = await request(app)
        .post(url)
        .set("Cookie", f.customer.cookie)
        .set("Origin", env.FRONTEND_URL[0]!)
        .send(body);
      expect(missing.status).toBe(403);
      const issued = await request(app)
        .post(url)
        .set("Cookie", f.customer.cookie)
        .set("Origin", env.FRONTEND_URL[0]!)
        .set("x-csrf-token", f.customer.csrf)
        .send(body);
      expect(issued.status, JSON.stringify(issued.body)).toBe(200);
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        at = new Date(),
        expiresAt = new Date(at.getTime() + 3600000);
      await prisma.session.create({
        data: {
          userId: f.actor.userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          createdAt: new Date(at.getTime() - 1000),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: at,
        },
      });
      const headers = {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: env.FRONTEND_URL[0]!,
        "x-csrf-token": csrf,
      };
      const selected = {
        expectedVersion: 1,
        pickupCode: issued.body.data.pickupCode,
        lines: f.lines,
      };
      const verified = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/pickup/verify`)
        .set(headers)
        .send(selected);
      expect(verified.status, JSON.stringify(verified.body)).toBe(200);
      const confirm = {
        ...selected,
        expectedVersion: verified.body.data.version,
        claimId: verified.body.data.claimId,
        authorisationId: verified.body.data.authorisationId,
        financialReviewHash: verified.body.data.financialReviewHash,
        idempotencyKey: randomUUID(),
        collectorName: "Synthetic HTTP collector",
        verificationNote:
          "Actual eligible goods and authorisation verified in isolated fixture",
        physicalHandoverConfirmed: false,
      };
      const refused = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/pickup/handover`)
        .set(headers)
        .send(confirm);
      expect(refused.status).toBe(422);
      expect(
        await prisma.orderPickupHandover.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      const collected = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/pickup/handover`)
        .set(headers)
        .send({ ...confirm, physicalHandoverConfirmed: true });
      expect(collected.status, JSON.stringify(collected.body)).toBe(200);
      expect(collected.body.data.complete).toBe(true);
      expect(JSON.stringify(collected.body)).not.toContain(issued.body.data.pickupCode);
    });
  },
);
