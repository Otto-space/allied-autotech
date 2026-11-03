import { OrderAftercareService } from "../../src/modules/orders/order-aftercare.service.js";
import { OperationalAlertsWorker } from "../../src/workers/operational-alerts.worker.js";
import { testCapability } from "../helpers/owner-policy.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { purchaseCookieName } from "../../src/common/security/cookies.js";
import { randomUUID } from "node:crypto";
import {
  fixtureAcceptedReview,
  reviewFixtureOrderForPayment,
} from "../helpers/purchase-review.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import {
  PaymentProviderRegistry,
  type OnlinePaymentProvider,
} from "../../src/providers/payments/payment-provider.registry.js";
import type {
  InitializePaymentCommand,
  PaymentProviderPort,
  VerifiedPayment,
} from "../../src/providers/payments/payment-provider.port.js";
import { fixture, account, get } from "../helpers/aftercare.js";
import { purchaseGuest } from "../helpers/purchase-guest.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const orders = new OrdersService();
const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function setup() {
  const f = await fixture(),
    guest = await purchaseGuest(f.customer.user.email);
  const credentials = { sessionToken: guest.sessionToken, csrfToken: guest.csrfToken };
  const result = (await orders.guestCheckout(
    credentials,
    {
      branchId: f.branch.id,
      fulfillmentMethod: "COLLECTION",
      contact: { name: "Synthetic Guest Payer", phone: "+2348000000000" },
      items: [{ productId: f.inventory.productId, quantity: 2 }],
    },
    randomUUID(),
    context(),
  )) as { order: { id: string } };
  const commands: InitializePaymentCommand[] = [];
  const results = {
    status: "success" as VerifiedPayment["status"],
    amount: 21500n,
    currency: "NGN",
    verifications: 0,
  };
  const port = (provider: OnlinePaymentProvider): PaymentProviderPort => ({
    async initialize(command) {
      commands.push(command);
      return {
        authorizationUrl: `https://checkout.${provider === "PAYSTACK" ? "paystack" : "monnify"}.com/${command.reference}`,
        accessCode: "synthetic-guest-access",
        providerReference: command.reference,
        authorizationExpiresAt: new Date(Date.now() + 600_000),
      };
    },
    async verify(reference) {
      results.verifications++;
      return {
        reference,
        gatewayTransactionId: `guest-fixture-${reference}`,
        status: results.status,
        amountKobo: results.amount,
        currency: results.currency,
        paidAt: results.status === "success" ? new Date() : null,
        providerFeeKobo: 0n,
        method: "card",
      };
    },
    async refund() {
      throw Error("No external refund in guest payment fixtures");
    },
  });
  const payments = new PaymentsService(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: port("PAYSTACK"), MONNIFY: port("MONNIFY") }),
  );
  const intentKey = randomUUID();
  await reviewFixtureOrderForPayment(result.order.id, credentials);
  const intent = (await payments.guestCreateIntent(
    credentials,
    result.order.id,
    intentKey,
    context(),
    await fixtureAcceptedReview(result.order.id),
  )) as { payment: { id: string; amountKobo: string }; replayed: boolean };
  const reviewedOrder = await prisma.order.findUniqueOrThrow({
    where: { id: result.order.id },
    select: { version: true },
  });
  return {
    ...f,
    guest,
    credentials,
    guestOrderId: result.order.id,
    orderVersion: reviewedOrder.version,
    payments,
    intent,
    intentKey,
    commands,
    results,
  };
}
async function initialise(
  f: Awaited<ReturnType<typeof setup>>,
  provider: OnlinePaymentProvider = "PAYSTACK",
  key = randomUUID(),
) {
  return f.payments.guestInitialize(
    f.credentials,
    f.intent.payment.id,
    key,
    context(),
    provider,
  );
}

const aftercare = new OrderAftercareService();
const app = createApp({ checkReadiness: async () => undefined });
const key = () => `aftercare-v1.${Date.now()}.${randomUUID()}`;
const cookie = (f: Awaited<ReturnType<typeof setup>>) =>
  `${purchaseCookieName}=${f.guest.sessionToken}`;
async function pay(f: Awaited<ReturnType<typeof setup>>) {
  const attempt = await initialise(f);
  await f.payments.guestVerifyAttempt(
    f.credentials,
    f.intent.payment.id,
    attempt.attemptId,
    context(),
  );
  return attempt.attemptId;
}
async function actor(
  person: Awaited<ReturnType<typeof account>>,
): Promise<AuthenticatedActor> {
  const session = await prisma.session.findFirstOrThrow({
    where: { userId: person.user.id, revokedAt: null },
  });
  return {
    userId: person.user.id,
    email: person.user.email,
    role: person.user.role,
    sessionId: session.id,
    mfaRequired: session.mfaRequired,
    mfaVerifiedAt: session.mfaVerifiedAt,
  };
}
async function intake(
  f: Awaited<ReturnType<typeof setup>>,
  kind: "RETURN" | "CANCELLATION" = "RETURN",
) {
  const item = await prisma.orderItem.findFirstOrThrow({
    where: { orderId: f.guestOrderId },
  });
  return {
    kind,
    reason: "Synthetic buyer request requiring staff review",
    items: [{ orderItemId: item.id, quantity: 1 }],
  };
}
const cancel = (
  f: Awaited<ReturnType<typeof setup>>,
  requestKey = key(),
  expectedVersion = f.orderVersion,
) =>
  orders.guestCancel(
    f.credentials,
    f.guestOrderId,
    { expectedVersion, reason: "Synthetic cancellation before confirmation" },
    requestKey,
    context(),
  );
describe.skipIf(process.env["RUN_DATABASE_TESTS"] !== "true")(
  "guest cancellation, aftercare and human refund review",
  () => {
    beforeAll(() => assertIsolatedLoopbackDatabase());
    afterAll(() => prisma.$disconnect());
    it("cancels an unpaid owned order once under concurrent retries and releases only its holds", async () => {
      const f = await setup(),
        requestKey = key();
      const replies = await Promise.all([cancel(f, requestKey), cancel(f, requestKey)]);
      expect(replies.map((r) => r.replayed).sort()).toEqual([false, true]);
      expect((replies[0].order as { status: string }).status).toBe("CANCELLED");
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 12, reserved: 2 });
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.guestOrderId } } },
        }),
      ).toBe(0);
      const original = await aftercare.guestOriginal(
        f.guest.sessionToken,
        f.guestOrderId,
        "cancel",
        requestKey,
      );
      expect(original).toMatchObject({
        found: true,
        record: { id: f.guestOrderId, status: "CANCELLED" },
      });
      expect(
        await prisma.auditLog.findFirst({
          where: { entityId: f.guestOrderId, action: "STATUS_CHANGE" },
          orderBy: { createdAt: "desc" },
        }),
      ).toMatchObject({
        userId: null,
        newValues: { purchaseAccess: "EMAIL_VERIFIED_GUEST" },
      });
    });
    it("checks real ownership, CSRF, overposting and current versions before cancellation", async () => {
      const f = await setup(),
        other = await purchaseGuest();
      await expect(
        orders.guestCancel(
          { sessionToken: other.sessionToken, csrfToken: other.csrfToken },
          f.guestOrderId,
          { expectedVersion: 0, reason: "Foreign buyer cancellation" },
          key(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        orders.guestCancel(
          { ...f.credentials, csrfToken: "x".repeat(43) },
          f.guestOrderId,
          { expectedVersion: 0, reason: "Synthetic cancellation" },
          key(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(cancel(f, key(), 99)).rejects.toMatchObject({ statusCode: 409 });
      const response = await request(app)
        .post(`/api/v1/purchase/orders/${f.guestOrderId}/cancel`)
        .set("Cookie", cookie(f))
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.guest.csrfToken)
        .set("Idempotency-Key", key())
        .send({
          expectedVersion: 0,
          reason: "Synthetic cancellation",
          guestId: other.access.guestId,
        });
      expect(response.status).toBe(422);
      expect(
        await prisma.order.findUnique({ where: { id: f.guestOrderId } }),
      ).toMatchObject({ status: "PENDING", version: f.orderVersion });
    });
    it("records partial aftercare once and exposes only customer-visible fields through actual HTTP", async () => {
      const f = await setup(),
        input = await intake(f),
        requestKey = key();
      const response = await request(app)
        .post(`/api/v1/purchase/orders/${f.guestOrderId}/aftercare`)
        .set("Cookie", cookie(f))
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.guest.csrfToken)
        .set("Idempotency-Key", requestKey)
        .send(input);
      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        orderId: f.guestOrderId,
        kind: "RETURN",
        items: input.items,
        replayed: false,
      });
      for (const field of [
        "guestId",
        "customerId",
        "inspectionNote",
        "policySnapshot",
        "reviewReason",
      ])
        expect(response.body.data[field]).toBeUndefined();
      const replay = await aftercare.guestRequest(
        f.credentials,
        f.guestOrderId,
        input,
        context(),
        requestKey,
      );
      expect(replay).toMatchObject({
        id: response.body.data.id,
        guestId: f.guest.access.guestId,
        customerId: null,
        replayed: true,
      });
      const list = await request(app)
        .get(`/api/v1/purchase/orders/${f.guestOrderId}/aftercare`)
        .set("Cookie", cookie(f));
      expect(list.status).toBe(200);
      expect(list.body.data).toHaveLength(1);
      const original = await request(app)
        .get(
          `/api/v1/purchase/orders/${f.guestOrderId}/aftercare/original-request?operation=aftercare`,
        )
        .set("Cookie", cookie(f))
        .set("Idempotency-Key", requestKey);
      expect(original.status).toBe(200);
      expect(original.body.data).toMatchObject({
        found: true,
        record: { id: replay.id },
        canStartNew: false,
      });
      await expect(
        aftercare.guestRequest(
          f.credentials,
          f.guestOrderId,
          { ...input, reason: "Changed content on the same retry key" },
          context(),
          requestKey,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("rejects foreign line quantities and same-email account records", async () => {
      const f = await setup(),
        input = await intake(f),
        other = await purchaseGuest();
      await expect(
        aftercare.guestRequest(
          f.credentials,
          f.guestOrderId,
          { ...input, items: [{ ...input.items[0]!, quantity: 3 }] },
          context(),
          key(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        aftercare.guestRequest(f.credentials, f.order.id, input, context(), key()),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        aftercare.guestList(other.sessionToken, f.guestOrderId),
      ).rejects.toMatchObject({ statusCode: 404 });
      const missing = await aftercare.guestOriginal(
        f.guest.sessionToken,
        f.guestOrderId,
        "aftercare",
        key(),
      );
      expect(missing).toMatchObject({ found: false, record: null, canStartNew: false });
    });
    it("keeps confirmed-order cancellation as a reviewed request and preserves stock/payment separation", async () => {
      const f = await setup();
      await pay(f);
      await orders.transition(
        await actor(f.admin),
        f.guestOrderId,
        { expectedVersion: f.orderVersion, status: "CONFIRMED" },
        context(),
      );
      await expect(cancel(f, key(), f.orderVersion + 1)).rejects.toMatchObject({
        statusCode: 409,
      });
      const saved = await aftercare.guestRequest(
        f.credentials,
        f.guestOrderId,
        await intake(f, "CANCELLATION"),
        context(),
        key(),
      );
      expect(saved).toMatchObject({
        kind: "CANCELLATION",
        status: "REQUESTED",
        guestId: f.guest.access.guestId,
      });
      expect(
        await prisma.order.findUnique({ where: { id: f.guestOrderId } }),
      ).toMatchObject({ status: "CONFIRMED" });
      expect(
        await prisma.inventory.findUnique({ where: { id: f.inventory.id } }),
      ).toMatchObject({ quantity: 10, reserved: 2 });
      expect(
        await prisma.refund.count({
          where: { paymentAttempt: { payment: { orderId: f.guestOrderId } } },
        }),
      ).toBe(0);
    });
    it("preserves cancellation and review in limited mode, rejects revoked access and catalogue mode", async () => {
      const f = await setup(),
        previous = env.PUBLIC_LAUNCH_MODE;
      try {
        env.PUBLIC_LAUNCH_MODE = "browse_enquiries";
        await aftercare.guestRequest(
          f.credentials,
          f.guestOrderId,
          await intake(f),
          context(),
          key(),
        );
        await cancel(f);
        env.PUBLIC_LAUNCH_MODE = "catalogue";
        await expect(
          aftercare.guestList(f.guest.sessionToken, f.guestOrderId),
        ).rejects.toMatchObject({ statusCode: 403 });
      } finally {
        env.PUBLIC_LAUNCH_MODE = previous;
      }
      await prisma.purchaseGuestSession.update({
        where: { id: f.guest.access.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        aftercare.guestList(f.guest.sessionToken, f.guestOrderId),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
    it("routes paid cancellation to a real human refund requester and independent approval; failed review reopens", async () => {
      const f = await setup(),
        attemptId = await pay(f);
      await cancel(f);
      expect(
        await prisma.operationalAlert.findUnique({
          where: { key: `guest-cancellation-refund:${f.guestOrderId}` },
        }),
      ).toMatchObject({ category: "GUEST_ORDER_REFUND_REVIEW", resolvedAt: null });
      expect(await prisma.refund.count({ where: { paymentAttemptId: attemptId } })).toBe(
        0,
      );
      const operator = await actor(f.admin);
      await expect(
        f.payments.requestRefund(
          operator,
          {
            paymentAttemptId: attemptId,
            amountKobo: 20000n,
            reason: "Synthetic full free cancellation",
          },
          randomUUID(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const requested = (await f.payments.requestRefund(
        operator,
        {
          paymentAttemptId: attemptId,
          amountKobo: 21500n,
          reason: "Synthetic full free cancellation",
        },
        randomUUID(),
        context(),
      )) as { refund: { id: string } };
      expect(
        await prisma.refund.findUnique({ where: { id: requested.refund.id } }),
      ).toMatchObject({
        requestedByUserId: f.admin.user.id,
        approvedByUserId: null,
        authorizationKind: "HUMAN",
        status: "REQUESTED",
        amountKobo: 21500n,
      });
      await testCapability(f.admin.user.id, "REFUND_APPROVE");
      await expect(
        f.payments.decideRefund(
          operator,
          requested.refund.id,
          { decision: "APPROVED" },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await new OperationalAlertsWorker().runOnce();
      expect(
        (
          await prisma.operationalAlert.findUniqueOrThrow({
            where: { key: `guest-cancellation-refund:${f.guestOrderId}` },
          })
        ).resolvedAt,
      ).not.toBeNull();
      const approver = await account("ADMIN");
      await testCapability(approver.user.id, "REFUND_APPROVE");
      await f.payments.decideRefund(
        await actor(approver),
        requested.refund.id,
        {
          decision: "CANCELLED",
          note: "Synthetic request needs corrected operator evidence",
        },
        context(),
      );
      await new OperationalAlertsWorker().runOnce();
      expect(
        (
          await prisma.operationalAlert.findUniqueOrThrow({
            where: { key: `guest-cancellation-refund:${f.guestOrderId}` },
          })
        ).resolvedAt,
      ).toBeNull();
      expect(f.results.verifications).toBe(1);
    });
    it("queues a capture verified after cancellation without treating a missing order paidAt as unpaid", async () => {
      const f = await setup();
      const attempt = await initialise(f);
      await cancel(f);
      await f.payments.guestVerifyAttempt(
        f.credentials,
        f.intent.payment.id,
        attempt.attemptId,
        context(),
      );
      expect(
        await prisma.order.findUniqueOrThrow({ where: { id: f.guestOrderId } }),
      ).toMatchObject({ status: "CANCELLED", paidAt: null, confirmedAt: null });
      expect(
        await prisma.paymentAttempt.findUniqueOrThrow({
          where: { id: attempt.attemptId },
        }),
      ).toMatchObject({ status: "SUCCESSFUL", verificationStatus: "VERIFIED" });
      await new OperationalAlertsWorker().runOnce();
      expect(
        await prisma.operationalAlert.findUniqueOrThrow({
          where: { key: `guest-cancellation-refund:${f.guestOrderId}` },
        }),
      ).toMatchObject({ category: "GUEST_ORDER_REFUND_REVIEW", resolvedAt: null });
      const operator = await actor(f.admin);
      await expect(
        f.payments.requestRefund(
          operator,
          {
            paymentAttemptId: attempt.attemptId,
            amountKobo: 20000n,
            reason: "Synthetic capture after free cancellation",
          },
          randomUUID(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const requested = (await f.payments.requestRefund(
        operator,
        {
          paymentAttemptId: attempt.attemptId,
          amountKobo: 21500n,
          reason: "Synthetic capture after free cancellation",
        },
        randomUUID(),
        context(),
      )) as { refund: { id: string } };
      expect(
        await prisma.refund.findUniqueOrThrow({ where: { id: requested.refund.id } }),
      ).toMatchObject({
        status: "REQUESTED",
        authorizationKind: "HUMAN",
        requestedByUserId: f.admin.user.id,
        approvedByUserId: null,
        amountKobo: 21500n,
      });
      expect(f.results.verifications).toBe(1);
    });
    it("recovers actual HTTP cancellation and uses the server clock for expired recovery keys", async () => {
      const f = await setup(),
        requestKey = key();
      const reply = await request(app)
        .post(`/api/v1/purchase/orders/${f.guestOrderId}/cancel`)
        .set("Cookie", cookie(f))
        .set("Origin", "http://localhost:3000")
        .set("X-CSRF-Token", f.guest.csrfToken)
        .set("Idempotency-Key", requestKey)
        .send({
          expectedVersion: f.orderVersion,
          reason: "Synthetic HTTP cancellation before confirmation",
        });
      expect(reply.status).toBe(200);
      expect(reply.body.data).toMatchObject({
        order: { id: f.guestOrderId, status: "CANCELLED" },
        replayed: false,
      });
      const receipt = await request(app)
        .get(
          `/api/v1/purchase/orders/${f.guestOrderId}/aftercare/original-request?operation=cancel`,
        )
        .set("Cookie", cookie(f))
        .set("Idempotency-Key", requestKey);
      expect(receipt.status).toBe(200);
      expect(receipt.body.data).toMatchObject({
        found: true,
        canStartNew: false,
        record: { id: f.guestOrderId, status: "CANCELLED" },
      });
      const expiredKey = `aftercare-v1.${Date.now() - 86_460_000}.${randomUUID()}`;
      expect(
        await aftercare.guestOriginal(
          f.guest.sessionToken,
          f.guestOrderId,
          "aftercare",
          expiredKey,
        ),
      ).toMatchObject({ found: false, record: null, canStartNew: true });
      const other = await purchaseGuest();
      await expect(
        aftercare.guestOriginal(other.sessionToken, f.guestOrderId, "cancel", requestKey),
      ).rejects.toMatchObject({ statusCode: 404 });
      const futureKey = `aftercare-v1.${Date.now() + 120_000}.${randomUUID()}`;
      await expect(
        aftercare.guestOriginal(
          f.guest.sessionToken,
          f.guestOrderId,
          "cancel",
          futureKey,
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("shows payment destinations only to existing administrators", async () => {
      const f = await setup();
      const admin = await get(f.admin, `/staff/orders/${f.guestOrderId}`);
      expect(admin.status).toBe(200);
      expect(admin.body.data.paymentReferences).toEqual([
        {
          id: f.intent.payment.id,
          paymentNumber: expect.any(String),
          status: "REQUIRES_PAYMENT",
        },
      ]);
      const staff = await get(f.staff, `/staff/orders/${f.guestOrderId}`);
      expect(staff.status).toBe(200);
      expect(staff.body.data.paymentReferences).toBeUndefined();
    });
  },
);
