import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { hashPassword } from "../../src/common/security/passwords.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { prisma } from "../../src/config/database.js";
import type { UserRole } from "../../src/generated/prisma/enums.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const origin = "http://localhost:3000";
async function user(role: UserRole, branchId?: string) {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `p8-${role.toLowerCase()}-${id}@example.test`,
      passwordHash: await hashPassword(`phase eight passphrase ${id}`),
      role,
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      ...(role === "CUSTOMER"
        ? {
            profile: {
              create: {
                firstName: "Phase",
                lastName: "Eight",
                phone: `+23480${id.replaceAll("-", "").slice(0, 8)}`,
              },
            },
          }
        : {
            staffProfile: {
              create: { firstName: "Phase", lastName: role, branchId: branchId ?? null },
            },
          }),
    },
    select: { id: true, role: true, profile: { select: { id: true } } },
  });
}
async function session(userId: string, role: UserRole) {
  const token = generateOpaqueToken();
  const csrf = generateOpaqueToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3_600_000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt,
      idleExpiresAt: expiresAt,
      createdAt: now,
      lastRotatedAt: now,
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: role === "CUSTOMER" ? null : now,
    },
  });
  return { cookie: `${sessionCookieName}=${token}`, csrf };
}
const headers = (value: Awaited<ReturnType<typeof session>>, key?: string) => ({
  Origin: origin,
  Cookie: value.cookie,
  "X-CSRF-Token": value.csrf,
  ...(key ? { "Idempotency-Key": key } : {}),
});

describe.skipIf(!runDatabaseTests)("Phase 8 payment flow", () => {
  afterAll(async () => prisma.$disconnect());
  it("settles reviewed manual payments once and prevents over-refunds", async () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const branch = await prisma.branch.create({
      data: {
        code: `P8-${randomUUID().slice(0, 8)}`,
        name: "Phase Eight",
        address: "8 Test Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const other = await prisma.branch.create({
      data: {
        code: `P8-${randomUUID().slice(0, 8)}`,
        name: "Other Eight",
        address: "9 Test Road",
        city: "Abuja",
        state: "FCT",
      },
    });
    const [customer, requester, otherStaff, admin] = await Promise.all([
      user("CUSTOMER"),
      user("ADMIN"),
      user("STAFF", other.id),
      user("ADMIN"),
    ]);
    const [customerSession, requesterSession, otherSession, adminSession] =
      await Promise.all([
        session(customer.id, customer.role),
        session(requester.id, requester.role),
        session(otherStaff.id, otherStaff.role),
        session(admin.id, admin.role),
      ]);
    const order = await prisma.order.create({
      data: {
        customerId: customer.profile!.id,
        branchId: branch.id,
        orderNumber: `P8-${randomUUID()}`,
        status: "PENDING",
        currency: "NGN",
        subtotalKobo: 10_000n,
        totalKobo: 10_000n,
        customerName: "Phase Eight",
        customerEmail: `snapshot-${randomUUID()}@example.test`,
        customerPhone: "+2348000000000",
        paymentDueAt: new Date(Date.now() + 3_600_000),
      },
    });
    const create = await request(app)
      .post("/api/v1/customers/payments")
      .set(headers(customerSession, "p8-payment-intent"))
      .send({ targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" });
    expect(create.status).toBe(201);
    expect(create.body.data.payment.amountKobo).toBe("10000");
    const paymentId = create.body.data.payment.id as string;
    const replay = await request(app)
      .post("/api/v1/customers/payments")
      .set(headers(customerSession, "p8-payment-intent"))
      .send({ targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" });
    expect(replay.body.data.replayed).toBe(true);
    const transferredAt = new Date().toISOString();
    const manual = await request(app)
      .post(`/api/v1/customers/payments/${paymentId}/manual`)
      .set(headers(customerSession, "p8-manual-payment"))
      .send({
        method: "BANK_TRANSFER",
        bankReference: "P8-TRANSFER",
        payerName: "Phase Eight",
        transferredAt,
      });
    expect(manual.status).toBe(201);
    const attemptId = manual.body.data.attempts[0].id as string;
    const manualReplay = await request(app)
      .post(`/api/v1/customers/payments/${paymentId}/manual`)
      .set(headers(customerSession, "p8-manual-payment"))
      .send({
        method: "BANK_TRANSFER",
        bankReference: "P8-TRANSFER",
        payerName: "Phase Eight",
        transferredAt,
      });
    expect(manualReplay.status).toBe(201);
    expect(manualReplay.body.data.replayed).toBe(true);
    expect(
      await prisma.paymentAttempt.count({
        where: { paymentId, provider: "MANUAL" },
      }),
    ).toBe(1);
    const review = await request(app)
      .post(`/api/v1/staff/payments/manual-attempts/${attemptId}/review`)
      .set(headers(adminSession))
      .send({
        decision: "APPROVED",
        reviewerNote: "Matched independently against bank records",
      });
    expect(review.status).toBe(200);
    expect(review.body.data.status).toBe("SUCCEEDED");
    expect(
      await prisma.paymentLedgerEntry.count({
        where: { paymentAttemptId: attemptId, type: "CAPTURE" },
      }),
    ).toBe(1);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paidAt,
    ).not.toBeNull();
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PROCESSING", processingAt: new Date() },
    });
    const settledReplay = await request(app)
      .post("/api/v1/customers/payments")
      .set(headers(customerSession, "p8-payment-intent"))
      .send({ targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" });
    expect(settledReplay.status).toBe(201);
    expect(settledReplay.body.data.replayed).toBe(true);
    expect(settledReplay.body.data.payment.id).toBe(paymentId);
    expect(settledReplay.body.data.payment.status).toBe("SUCCEEDED");
    const newIntent = await request(app)
      .post("/api/v1/customers/payments")
      .set(headers(customerSession, "p8-new-key-after-processing"))
      .send({ targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" });
    expect(newIntent.status).toBe(404);
    expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
    const changedReplay = await request(app)
      .post("/api/v1/customers/payments")
      .set(headers(customerSession, "p8-payment-intent"))
      .send({ targetType: "ORDER", targetId: randomUUID(), purpose: "ORDER_PAYMENT" });
    expect(changedReplay.status).toBe(409);
    const stranger = await user("CUSTOMER");
    const strangerSession = await session(stranger.id, stranger.role);
    const stolenReplay = await request(app)
      .post("/api/v1/customers/payments")
      .set(headers(strangerSession, "p8-payment-intent"))
      .send({ targetType: "ORDER", targetId: order.id, purpose: "ORDER_PAYMENT" });
    expect(stolenReplay.status).toBe(404);
    expect(stolenReplay.body).not.toHaveProperty("data");
    const crossBranch = await request(app)
      .get("/api/v1/staff/payments")
      .set("Cookie", otherSession.cookie);
    expect(crossBranch.status).toBe(403);
    expect(crossBranch.body).not.toHaveProperty("data");
    const refunds = await Promise.all([
      request(app)
        .post("/api/v1/staff/payments/refunds")
        .set(headers(requesterSession, "p8-refund-one"))
        .send({
          paymentAttemptId: attemptId,
          amountKobo: "7000",
          reason: "Approved partial refund",
        }),
      request(app)
        .post("/api/v1/staff/payments/refunds")
        .set(headers(requesterSession, "p8-refund-two"))
        .send({
          paymentAttemptId: attemptId,
          amountKobo: "7000",
          reason: "Concurrent duplicate exposure",
        }),
    ]);
    expect(refunds.map(({ status }) => status).sort()).toEqual([201, 409]);
    const refundId = refunds.find(({ status }) => status === 201)!.body.data.refund
      .id as string;
    const decision = await request(app)
      .post(`/api/v1/staff/payments/refunds/${refundId}/decision`)
      .set(headers(adminSession))
      .send({ decision: "APPROVED" });
    expect(decision.status).toBe(200);
    expect(decision.body.data.status).toBe("NEEDS_ATTENTION");

    let activeReference = "";
    const providerRefundId = `provider-refund-${randomUUID()}`;
    const provider: PaymentProviderPort = {
      async initialize(command) {
        activeReference = command.reference;
        return {
          authorizationUrl: "https://checkout.example.test/authorize",
          accessCode: "test-access-code",
          providerReference: command.reference,
          authorizationExpiresAt: new Date(Date.now() + 600_000),
        };
      },
      async verify(reference) {
        return {
          reference,
          gatewayTransactionId: `gateway-${reference}`,
          status: "success",
          amountKobo: 20_000n,
          currency: "NGN",
          paidAt: new Date(),
          providerFeeKobo: 300n,
          method: "card",
        };
      },
      async refund() {
        return { providerRefundId, status: "pending" };
      },
    };
    const service = new PaymentsService(
      prisma,
      new PaymentProviderRegistry({ PAYSTACK: provider }),
    );
    const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };
    const customerActor = {
      userId: customer.id,
      sessionId: randomUUID(),
      email: "customer@example.test",
      role: "CUSTOMER" as const,
      mfaRequired: false,
      mfaVerifiedAt: null,
    };
    const requesterActor = {
      userId: requester.id,
      sessionId: randomUUID(),
      email: "requester@example.test",
      role: "ADMIN" as const,
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    };
    const adminActor = {
      userId: admin.id,
      sessionId: randomUUID(),
      email: "admin@example.test",
      role: "ADMIN" as const,
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    };
    const onlineOrder = await prisma.order.create({
      data: {
        customerId: customer.profile!.id,
        branchId: branch.id,
        orderNumber: `P8-${randomUUID()}`,
        status: "PENDING",
        currency: "NGN",
        subtotalKobo: 20_000n,
        totalKobo: 20_000n,
        customerName: "Phase Eight",
        customerEmail: `online-${randomUUID()}@example.test`,
        customerPhone: "+2348000000001",
        paymentDueAt: new Date(Date.now() + 3_600_000),
      },
    });
    const onlineResult = (await service.createIntent(
      customerActor,
      { targetType: "ORDER", targetId: onlineOrder.id, purpose: "ORDER_PAYMENT" },
      "online-intent",
      context,
    )) as { payment: { id: string } };
    const onlineId = onlineResult.payment.id;
    const initialized = await service.initializePaystack(
      customerActor,
      onlineId,
      "online-attempt",
      context,
    );
    expect(initialized).toMatchObject({ replayed: false });
    const initializedAgain = await service.initializePaystack(
      customerActor,
      onlineId,
      "online-attempt",
      context,
    );
    expect(initializedAgain).toMatchObject({ replayed: true });
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { internalReference: activeReference },
    });
    await service.verifyAttempt(customerActor, onlineId, attempt.id, context);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: onlineId } })).status,
    ).toBe("SUCCEEDED");
    const requested = (await service.requestRefund(
      requesterActor,
      {
        paymentAttemptId: attempt.id,
        amountKobo: 1_000n,
        reason: "Provider refund test",
      },
      "provider-refund",
      context,
    )) as { refund: { id: string } };
    await service.decideRefund(
      adminActor,
      requested.refund.id,
      { decision: "APPROVED" },
      context,
    );
    await service.ingestWebhook(
      {
        eventType: "refund.processed",
        providerEventId: `refund.processed:${providerRefundId}`,
        resourceId: providerRefundId,
        reference: providerRefundId,
        gatewayTransactionId: null,
        status: "processed",
        amountKobo: 1_000n,
        currency: "NGN",
        paidAt: null,
        providerFeeKobo: null,
        method: null,
        category: null,
        responseDueAt: null,
      },
      "b".repeat(64),
      context,
    );
    expect(
      (await prisma.refund.findUniqueOrThrow({ where: { id: requested.refund.id } }))
        .status,
    ).toBe("SUCCEEDED");
    const providerDisputeId = `dispute-${randomUUID()}`;
    const disputeEvent = {
      eventType: "charge.dispute.resolve",
      providerEventId: `charge.dispute.resolve:${providerDisputeId}`,
      resourceId: providerDisputeId,
      reference: activeReference,
      gatewayTransactionId: null,
      status: "lost",
      amountKobo: 20_000n,
      currency: "NGN",
      paidAt: null,
      providerFeeKobo: null,
      method: null,
      category: "fraud",
      responseDueAt: null,
    };
    await service.ingestWebhook(disputeEvent, "c".repeat(64), context);
    const disputeReplay = await service.ingestWebhook(
      disputeEvent,
      "c".repeat(64),
      context,
    );
    expect(disputeReplay.duplicate).toBe(true);
    expect(
      await prisma.paymentLedgerEntry.count({
        where: { type: "CHARGEBACK", dispute: { providerDisputeId } },
      }),
    ).toBe(1);
  }, 30_000);
});
