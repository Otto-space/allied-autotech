import { hashToken } from "../../src/common/security/session-tokens.js";
import {
  purchaseCookieName,
  sessionCookieName,
} from "../../src/common/security/cookies.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { OrderSupplyExceptionService } from "../../src/modules/orders/order-supply-exception.service.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { assertReviewedPurchasePayable } from "../../src/modules/orders/purchase-review-payable.js";
import { createOrderMoneyAllocation } from "../../src/modules/orders/order-money-allocation.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";
import { testOwner } from "../helpers/owner.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { reviewSourceCustomer } from "../helpers/review-sources.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
const context = {
  requestId: "synthetic-supply-exception",
  ipAddress: null,
  userAgent: null,
};
describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "isolated order supply concern intake",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    async function fixture(guest = false) {
      const suffix = randomUUID(),
        owner = await testOwner("unusable-supply-fixture"),
        buyer = await reviewSourceCustomer(),
        access = guest ? await purchaseGuest() : null;
      const actor: AuthenticatedActor = {
        userId: owner.id,
        email: owner.email,
        role: owner.role,
        sessionId: await paymentTestSession(owner.id, owner.role),
        mfaRequired: true,
        mfaVerifiedAt: new Date(),
      };
      const customerActor: AuthenticatedActor = {
        userId: buyer.user.id,
        email: buyer.user.email,
        role: "CUSTOMER",
        sessionId: await paymentTestSession(buyer.user.id),
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
      const branch = await prisma.branch.create({
        data: {
          code: suffix.slice(0, 10),
          name: "Synthetic supply branch",
          address: "Isolated fixture",
          city: "Lagos",
          state: "Lagos",
        },
      });
      const category = await prisma.category.create({
        data: { name: "Synthetic supply parts", slug: suffix },
      });
      const product = await prisma.product.create({
        data: {
          name: "Synthetic ordered part",
          slug: suffix,
          sku: suffix,
          categoryId: category.id,
          priceKobo: 101n,
        },
      });
      const item = {
        id: randomUUID(),
        quantity: 3,
        unitPriceKobo: 101n,
        subtotalKobo: 303n,
      };
      const order = await prisma.order.create({
        data: {
          customerId: access ? null : buyer.customerId,
          guestId: access?.access.guestId ?? null,
          branchId: branch.id,
          orderNumber: suffix,
          customerName: "Synthetic actual buyer",
          customerEmail: access?.access.email ?? buyer.user.email,
          customerPhone: "08030000000",
          subtotalKobo: 303n,
          discountAmountKobo: 5n,
          taxKobo: 22n,
          totalKobo: 320n,
          policySnapshot: {
            monetaryAllocation: createOrderMoneyAllocation([item], 5n, 22n),
          },
          items: {
            create: {
              ...item,
              productId: product.id,
              productName: product.name,
              sku: product.sku,
            },
          },
        },
        include: { items: true },
      });
      const body = {
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
        kind: "UNAVAILABLE",
        affectedLines: [{ orderItemId: item.id, offset: 0, quantity: 1 }],
        customerNote:
          "The original item cannot currently be supplied. Care will review the next step with you.",
        reason: "Private verified supplier conversation in an isolated fixture",
        actualConcernConfirmed: true,
      };
      const service = new OrderSupplyExceptionService();
      const principal = access
        ? { kind: "guest" as const, sessionToken: access.sessionToken }
        : { kind: "account" as const, actor: customerActor };
      return {
        actor,
        customerActor,
        buyer,
        branch,
        order,
        body,
        service,
        principal,
        access,
      };
    }
    const choiceInput = (supplyExceptionId: string, expectedVersion = 1) => ({
      expectedVersion,
      supplyExceptionId,
      idempotencyKey: randomUUID(),
      choice: "REFUND_REVIEW",
      statementVersion: "SUPPLY_CHOICE_20261110_V1",
      choiceConfirmed: true,
      customerNote: "Please review the affected original portion for a refund.",
    });
    it("retains real customer choice and changed-choice history without moving money or releasing the hold", async () => {
      const f = await fixture();
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const input = choiceInput(concern.id);
      const saved = await f.service.choose(f.principal, f.order.id, input, context);
      expect(saved.orderVersion).toBe(2);
      expect(saved.items[0]!.supplyRemedyChoices).toHaveLength(1);
      expect(saved.items[0]).toMatchObject({
        financialApproval: false,
        alternativeAccepted: false,
        supplyRemedyChoices: [
          { choice: "REFUND_REVIEW", customerNote: input.customerNote },
        ],
      });
      const replay = await f.service.choose(f.principal, f.order.id, input, context);
      expect(replay.orderVersion).toBe(2);
      expect(replay.items[0]!.supplyRemedyChoices[0]!.id).toBe(
        saved.items[0]!.supplyRemedyChoices[0]!.id,
      );
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...input, choice: "SUITABLE_ALTERNATIVE_REVIEW" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const changed = await f.service.choose(
        f.principal,
        f.order.id,
        {
          ...input,
          expectedVersion: 2,
          idempotencyKey: randomUUID(),
          choice: "SUITABLE_ALTERNATIVE_REVIEW",
        },
        context,
      );
      expect(changed.items[0]!.supplyRemedyChoices.map((row) => row.choice)).toEqual([
        "SUITABLE_ALTERNATIVE_REVIEW",
        "REFUND_REVIEW",
      ]);
      expect(changed.orderVersion).toBe(3);
      const safe = JSON.stringify(changed);
      for (const secret of [
        f.body.reason,
        "customerUserId",
        "guestSessionId",
        "sessionId",
        "requestHash",
        "idempotencyKey",
      ])
        expect(safe).not.toContain(secret);
      const stored = await prisma.orderSupplyRemedyChoice.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.update({
          where: { id: stored.id },
          data: { choice: "TECHNICAL_REVIEW" },
        }),
      ).rejects.toThrow(/immutable/);
      await expect(
        prisma.orderSupplyRemedyChoice.delete({ where: { id: stored.id } }),
      ).rejects.toThrow(/immutable/);
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.order.id } } },
        }),
      ).toBe(0);
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("serializes distinct customer choices and refuses stale or foreign concerns", async () => {
      const f = await fixture(),
        other = await fixture();
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const input = choiceInput(concern.id);
      await expect(
        f.service.choose(other.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        f.service.choose({ kind: "account", actor: f.actor }, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...input, supplyExceptionId: randomUUID() },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      const results = await Promise.allSettled([
        f.service.choose(f.principal, f.order.id, input, context),
        f.service.choose(
          f.principal,
          f.order.id,
          {
            ...input,
            idempotencyKey: randomUUID(),
            choice: "SUITABLE_ALTERNATIVE_REVIEW",
          },
          context,
        ),
      ]);
      expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.orderSupplyRemedyChoice.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      await expect(
        f.service.choose(
          f.principal,
          f.order.id,
          { ...input, idempotencyKey: randomUUID() },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const stored = await prisma.orderSupplyRemedyChoice.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.create({
          data: {
            ...stored,
            id: randomUUID(),
            orderVersion: 2,
            customerUserId: other.customerActor.userId,
            sessionId: other.customerActor.sessionId,
            idempotencyKey: randomUUID(),
          },
        }),
      ).rejects.toThrow(/actual customer/);
      await prisma.session.update({
        where: { id: f.customerActor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.choose(f.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
    it("requires current guest proof and CSRF for a choice without borrowing account access", async () => {
      const f = await fixture(true),
        other = await fixture(true);
      const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
        .items[0]!;
      const input = choiceInput(concern.id);
      await expect(
        f.service.choose(f.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.service.choose(
          {
            kind: "guest",
            sessionToken: other.access!.sessionToken,
            csrfToken: other.access!.csrfToken,
          },
          f.order.id,
          input,
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      const principal = { ...f.principal, csrfToken: f.access!.csrfToken };
      const saved = await f.service.choose(principal, f.order.id, input, context);
      expect(saved.items[0]!.supplyRemedyChoices[0]!.choice).toBe("REFUND_REVIEW");
      await prisma.purchaseGuestSession.update({
        where: { id: f.access!.access.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.choose(principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
    it("keeps installed/used/diagnosis choices in technical assessment without a general return entitlement", async () => {
      const f = await fixture();
      const concern = (
        await f.service.raise(
          f.actor,
          f.order.id,
          { ...f.body, kind: "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" },
          context,
        )
      ).items[0]!;
      const input = choiceInput(concern.id);
      await expect(
        f.service.choose(f.principal, f.order.id, input, context),
      ).rejects.toMatchObject({ statusCode: 409 });
      const saved = await f.service.choose(
        f.principal,
        f.order.id,
        { ...input, choice: "TECHNICAL_REVIEW" },
        context,
      );
      expect(saved.items[0]).toMatchObject({
        monetaryBasis: { amounts: null, feeKobo: null },
        financialApproval: false,
        supplyRemedyChoices: [{ choice: "TECHNICAL_REVIEW" }],
      });
      const stored = await prisma.orderSupplyRemedyChoice.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      await expect(
        prisma.orderSupplyRemedyChoice.create({
          data: {
            ...stored,
            id: randomUUID(),
            orderVersion: 2,
            choice: "REFUND_REVIEW",
            idempotencyKey: randomUUID(),
          },
        }),
      ).rejects.toThrow(/technical assessment/);
    });
    it("requires account and guest HTTP origin/CSRF, rejects mixed cookies and returns a safe no-store choice receipt", async () => {
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      for (const guest of [false, true]) {
        const f = await fixture(guest);
        const concern = (await f.service.raise(f.actor, f.order.id, f.body, context))
          .items[0]!;
        const input = choiceInput(concern.id);
        const path = `/api/v1/${guest ? "purchase" : "customers"}/orders/${f.order.id}/supply-exceptions/choice`;
        const cookie = guest
          ? `${purchaseCookieName}=${f.access!.sessionToken}`
          : f.buyer.cookie;
        expect(
          (
            await request(app)
              .post(path)
              .set("Cookie", cookie)
              .set("Origin", env.FRONTEND_URL[0]!)
              .set("x-csrf-token", "x".repeat(43))
              .send(input)
          ).status,
        ).toBe(403);
        if (guest)
          expect(
            (
              await request(app)
                .post(path)
                .set("Cookie", `${cookie}; ${f.buyer.cookie}`)
                .set("Origin", env.FRONTEND_URL[0]!)
                .set("x-csrf-token", f.access!.csrfToken)
                .send(input)
            ).status,
          ).toBe(409);
        const result = await request(app)
          .post(path)
          .set("Cookie", cookie)
          .set("Origin", env.FRONTEND_URL[0]!)
          .set("x-csrf-token", guest ? f.access!.csrfToken : f.buyer.csrf)
          .send(input);
        expect(result.status, JSON.stringify(result.body)).toBe(200);
        expect(result.headers["cache-control"]).toContain("no-store");
        expect(result.body.data.items[0].supplyRemedyChoices[0].choice).toBe(
          "REFUND_REVIEW",
        );
        expect(JSON.stringify(result.body)).not.toContain("sessionId");
      }
    });
    it("binds exact affected quantities, creates a durable owned Care case and replays without duplicates", async () => {
      const f = await fixture();
      const first = await f.service.raise(f.actor, f.order.id, f.body, context);
      expect(first.items).toHaveLength(1);
      expect(first.items[0]!.monetaryBasis).toMatchObject({
        status: "SAVED_ORDER_ALLOCATION",
        feeKobo: "0",
        financialApproval: false,
        reviewOnly: true,
        amounts: { totalKobo: "107", taxKobo: "8" },
      });
      const replay = await f.service.raise(f.actor, f.order.id, f.body, context);
      expect(replay.items[0]!.id).toBe(first.items[0]!.id);
      expect(
        await prisma.orderSupplyException.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      const caseRecord = await prisma.enquiry.findUniqueOrThrow({
        where: { id: first.items[0]!.enquiryId },
      });
      expect(caseRecord).toMatchObject({
        customerId: f.order.customerId,
        branchId: f.branch.id,
        status: "OPEN",
      });
      expect(caseRecord.message).not.toContain(f.body.reason);
      const safe = await f.service.read(f.principal, f.order.id);
      for (const secret of [
        f.body.reason,
        "requestHash",
        "idempotencyKey",
        "raisedByUserId",
        "sessionId",
      ])
        expect(JSON.stringify(safe)).not.toContain(secret);
      await expect(
        f.service.raise(
          f.actor,
          f.order.id,
          { ...f.body, reason: "Changed replay contents must not create another case" },
          context,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.order.id } } },
        }),
      ).toBe(0);
      await expect(
        prisma.orderSupplyException.delete({ where: { id: first.items[0]!.id } }),
      ).rejects.toThrow();
      await expect(
        prisma.orderSupplyException.update({
          where: { id: first.items[0]!.id },
          data: { reason: "Rewritten facts" },
        }),
      ).rejects.toThrow();
    });
    it("serializes overlapping intake and blocks another charge while preserving original values", async () => {
      const f = await fixture();
      const results = await Promise.allSettled([
        f.service.raise(f.actor, f.order.id, f.body, context),
        f.service.raise(
          f.actor,
          f.order.id,
          { ...f.body, idempotencyKey: randomUUID() },
          context,
        ),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(
        await prisma.orderSupplyException.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("supply concern"),
      });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } })).totalKobo,
      ).toBe(320n);
      expect(await prisma.payment.count({ where: { orderId: f.order.id } })).toBe(0);
    });
    it("requires actual current administrator MFA and keeps customer/guest ownership private", async () => {
      const f = await fixture(true),
        other = await fixture();
      await expect(
        f.service.raise({ ...f.actor, mfaVerifiedAt: null }, f.order.id, f.body, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      await f.service.raise(f.actor, f.order.id, f.body, context);
      expect((await f.service.read(f.principal, f.order.id)).items).toHaveLength(1);
      await expect(f.service.read(other.principal, f.order.id)).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(
        f.service.read({ kind: "account", actor: f.customerActor }, f.order.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await prisma.session.update({
        where: { id: f.actor.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.service.readStaff(f.actor, f.order.id, context),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
    });
    it("retains actual staff branch scope, restricted private notes and a real Care alert", async () => {
      const f = await fixture(),
        other = await fixture();
      const staff = await prisma.user.create({
        data: {
          email: `supply-care-${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-staff",
          role: "STAFF",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: { firstName: "Synthetic", lastName: "Care", branchId: f.branch.id },
          },
        },
      });
      const actor: AuthenticatedActor = {
        ...f.actor,
        userId: staff.id,
        email: staff.email,
        role: "STAFF",
        sessionId: await paymentTestSession(staff.id, "STAFF"),
      };
      await expect(
        f.service.raise(actor, f.order.id, f.body, context),
      ).rejects.toMatchObject({ statusCode: 403 });
      const result = await f.service.raise(f.actor, f.order.id, f.body, context);
      expect(
        JSON.stringify(await f.service.readStaff(actor, f.order.id, context)),
      ).not.toContain(f.body.reason);
      expect(
        await prisma.notification.count({
          where: {
            userId: staff.id,
            resourceType: "ENQUIRY",
            resourceId: result.items[0]!.enquiryId,
          },
        }),
      ).toBe(1);
      await expect(
        f.service.readStaff(actor, other.order.id, context),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      await prisma.staffProfile.update({
        where: { userId: staff.id },
        data: { branchId: null },
      });
      await expect(f.service.readStaff(actor, f.order.id, context)).rejects.toMatchObject(
        {
          statusCode: 403,
        },
      );
    });
    it("keeps used/installed/disputed reports in technical assessment rather than inventing a refund policy", async () => {
      const f = await fixture();
      const result = await f.service.raise(
        f.actor,
        f.order.id,
        { ...f.body, kind: "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" },
        context,
      );
      expect(result.items[0]!.monetaryBasis).toMatchObject({
        status: "TECHNICAL_ASSESSMENT_REQUIRED",
        amounts: null,
        feeKobo: null,
        financialApproval: false,
      });
    });
    it("automatically routes an unavailable sourcing update once without silently resolving it on an estimate change", async () => {
      const f = await fixture(),
        orders = new OrdersService();
      const input = {
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
        lines: f.order.items.map((item) => ({
          orderItemId: item.id,
          sourcingStatus: "UNAVAILABLE",
          sourcingFrom: null,
          sourcingUntil: null,
          preparationMinutes: null,
        })),
        customerNote: f.body.customerNote,
        reason: f.body.reason,
      };
      await orders.updateTiming(f.actor, f.order.id, input, context);
      const first = await f.service.readStaff(f.actor, f.order.id, context);
      expect(first.items).toHaveLength(1);
      await orders.updateTiming(
        f.actor,
        f.order.id,
        { ...input, expectedVersion: 1, idempotencyKey: randomUUID() },
        context,
      );
      expect(
        (await f.service.readStaff(f.actor, f.order.id, context)).items,
      ).toHaveLength(1);
      const stored = await prisma.orderSupplyException.findUniqueOrThrow({
        where: { id: first.items[0]!.id },
      });
      expect(stored.sourceTimingUpdateId).toBeTruthy();
      expect(stored.affectedLines).toEqual([
        { orderItemId: f.order.items[0]!.id, offset: 0, quantity: 3 },
      ]);
      await orders.updateTiming(
        f.actor,
        f.order.id,
        {
          ...input,
          expectedVersion: 2,
          idempotencyKey: randomUUID(),
          lines: input.lines.map((line) => ({ ...line, sourcingStatus: "ARRIVED" })),
        },
        context,
      );
      await expect(
        prisma.$transaction((tx) => assertReviewedPurchasePayable(tx, f.order.id)),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("supply concern"),
      });
    });
    it("enforces HTTP CSRF and returns only safe buyer projection", async () => {
      const f = await fixture(),
        app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const token = randomUUID(),
        csrf = randomUUID().repeat(2),
        now = new Date(),
        expiresAt = new Date(now.getTime() + 3600000);
      await prisma.session.create({
        data: {
          userId: f.actor.userId,
          tokenHash: hashToken("session", token),
          csrfTokenHash: hashToken("csrf", csrf),
          createdAt: new Date(now.getTime() - 1000),
          expiresAt,
          idleExpiresAt: expiresAt,
          mfaRequired: true,
          mfaVerifiedAt: now,
        },
      });
      const headers = {
        Cookie: `${sessionCookieName}=${token}`,
        Origin: env.FRONTEND_URL[0]!,
      };
      const missing = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/supply-exceptions`)
        .set(headers)
        .send(f.body);
      expect(missing.status).toBe(403);
      expect(
        await prisma.orderSupplyException.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      const saved = await request(app)
        .post(`/api/v1/staff/orders/${f.order.id}/supply-exceptions`)
        .set(headers)
        .set("x-csrf-token", csrf)
        .send(f.body);
      expect(saved.status, JSON.stringify(saved.body)).toBe(200);
      const read = await request(app)
        .get(`/api/v1/customers/orders/${f.order.id}/supply-exceptions`)
        .set("Cookie", f.buyer.cookie);
      expect(read.status, JSON.stringify(read.body)).toBe(200);
      expect(JSON.stringify(read.body)).not.toContain(f.body.reason);
    });
  },
);
