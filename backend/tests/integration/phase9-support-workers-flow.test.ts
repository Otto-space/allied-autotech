import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { encryptNotificationPayload } from "../../src/common/security/mfa-encryption.js";
import { prisma } from "../../src/config/database.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { enqueueNotification } from "../../src/modules/notifications/notifications.service.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";
import { OrdersService } from "../../src/modules/orders/orders.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { SupportService } from "../../src/modules/support/support.service.js";
import type {
  EmailProvider,
  TransactionalEmail,
} from "../../src/providers/messaging/email-provider.port.js";
import {
  providerRejected,
  providerUnavailable,
} from "../../src/common/errors/provider-error-mapper.js";
import { NotificationDeliveryWorker } from "../../src/workers/notification.worker.js";

const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
const context = { requestId: randomUUID(), ipAddress: null, userAgent: null };

async function customer() {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      id,
      email: `phase9-${id}@example.test`,
      passwordHash: "synthetic-not-an-authentication-fixture",
      role: "CUSTOMER",
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      profile: {
        create: {
          firstName: "Synthetic",
          lastName: "Customer",
          phone: `+23480${id.replaceAll("-", "").slice(0, 8)}`,
        },
      },
    },
    select: { id: true, email: true, profile: { select: { id: true } } },
  });
}

function actor(user: { id: string; email: string }): AuthenticatedActor {
  return {
    userId: user.id,
    sessionId: randomUUID(),
    role: "CUSTOMER",
    email: user.email,
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
}

describe.skipIf(!runDatabaseTests)("Phase 9 support and worker flow", () => {
  afterAll(async () => prisma.$disconnect());

  it("enforces review eligibility, moderation, ownership, and safe publication", async () => {
    const support = new SupportService(prisma);
    const branch = await prisma.branch.create({
      data: {
        code: `P9-${randomUUID().slice(0, 8)}`,
        name: "Phase Nine Synthetic Branch",
        address: "9 Synthetic Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const service = await prisma.service.create({
      data: {
        name: "Phase Nine Service",
        slug: `p9-service-${randomUUID()}`,
        pricingType: "FIXED",
        priceKobo: 50_000n,
        durationMinutes: 60,
      },
    });
    const owner = await customer();
    const stranger = await customer();
    const booking = await prisma.booking.create({
      data: {
        customerId: owner.profile!.id,
        branchId: branch.id,
        serviceId: service.id,
        scheduledAt: new Date(Date.now() - 86_400_000),
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const review = await support.createReview(
      actor(owner),
      {
        targetType: "SERVICE",
        serviceId: service.id,
        bookingId: booking.id,
        rating: 5,
        comment: "Synthetic completed-service review",
      },
      context,
    );
    const category = await prisma.category.create({
      data: { name: "Phase Nine Review Category", slug: `p9-review-${randomUUID()}` },
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: "Phase Nine Reviewed Product",
        slug: `p9-reviewed-product-${randomUUID()}`,
        sku: `P9-REV-${randomUUID()}`,
        priceKobo: 20_000n,
      },
    });
    const order = await prisma.order.create({
      data: {
        customerId: owner.profile!.id,
        branchId: branch.id,
        orderNumber: `P9-REV-${randomUUID().slice(0, 24)}`,
        status: "COMPLETED",
        subtotalKobo: 20_000n,
        totalKobo: 20_000n,
        customerName: "Synthetic Customer",
        customerEmail: owner.email,
        customerPhone: "+2348000000000",
        completedAt: new Date(),
      },
    });
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPriceKobo: product.priceKobo,
        quantity: 1,
        subtotalKobo: product.priceKobo,
      },
    });
    const productReview = await support.createReview(
      actor(owner),
      {
        targetType: "PRODUCT",
        productId: product.id,
        orderItemId: orderItem.id,
        rating: 4,
        comment: "Synthetic verified-purchase product review",
      },
      context,
    );
    const businessReview = await support.createReview(
      actor(owner),
      {
        targetType: "BUSINESS",
        rating: 5,
        comment: "Synthetic overall experience review",
      },
      context,
    );
    await expect(
      support.createReview(
        actor(stranger),
        {
          targetType: "PRODUCT",
          productId: product.id,
          orderItemId: orderItem.id,
          rating: 1,
          comment: "Synthetic unauthorized review attempt",
        },
        context,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(
      (await support.publicReviews({ limit: 20 })).items.some(
        (item) => item.id === review.id,
      ),
    ).toBe(false);

    const adminId = randomUUID();
    const admin = await prisma.user.create({
      data: {
        id: adminId,
        email: `phase9-admin-${adminId}@example.test`,
        passwordHash: "synthetic-not-an-authentication-fixture",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        staffProfile: { create: { firstName: "Synthetic", lastName: "Administrator" } },
      },
      select: { id: true, email: true },
    });
    const adminActor: AuthenticatedActor = {
      ...actor(admin),
      role: "ADMIN",
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    };
    await support.moderateReview(
      adminActor,
      review.id,
      { expectedVersion: 0, decision: "APPROVED" },
      context,
    );
    await support.moderateReview(
      adminActor,
      productReview.id,
      { expectedVersion: 0, decision: "APPROVED" },
      context,
    );
    await support.moderateReview(
      adminActor,
      businessReview.id,
      { expectedVersion: 0, decision: "APPROVED" },
      context,
    );
    const published = await support.publicReviews({ limit: 20, targetType: "SERVICE" });
    expect(published.items.some((item) => item.id === review.id)).toBe(true);
    expect(published.items.find((item) => item.id === review.id)).not.toHaveProperty(
      "customerId",
    );
    const productPublished = await support.publicReviews({
      limit: 20,
      targetType: "PRODUCT",
      productId: product.id,
    });
    expect(
      productPublished.items.find((item) => item.id === productReview.id),
    ).toMatchObject({
      rating: 4,
      product: { id: product.id },
    });
    expect(
      (await support.publicReviews({ limit: 20, targetType: "BUSINESS" })).items.some(
        (item) => item.id === businessReview.id && item.rating === 5,
      ),
    ).toBe(true);

    const complaint = await support.createCustomerComplaint(
      actor(owner),
      {
        branchId: branch.id,
        subject: "Synthetic private complaint",
        description: "Visible only to its owner and authorized staff",
      },
      context,
    );
    await expect(
      support.customerComplaint(actor(stranger), complaint.id),
    ).rejects.toMatchObject({
      statusCode: 404,
    });
  }, 30_000);

  it("provides an owned, visibility-safe incremental support chat", async () => {
    const support = new SupportService(prisma);
    const owner = await customer();
    const stranger = await customer();
    const branch = await prisma.branch.create({
      data: {
        code: `P9-CHAT-${randomUUID().slice(0, 8)}`,
        name: "Phase Nine Chat Branch",
        address: "9 Support Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const enquiry = await prisma.enquiry.create({
      data: {
        customerId: owner.profile!.id,
        branchId: branch.id,
        type: "GENERAL",
        subject: "Synthetic chat",
        message: "Synthetic initial message",
        name: "Synthetic Customer",
        email: owner.email,
      },
    });
    const first = await prisma.supportMessage.create({
      data: {
        enquiryId: enquiry.id,
        authorUserId: owner.id,
        authorType: "CUSTOMER",
        visibility: "CUSTOMER",
        body: "Synthetic customer-visible message",
      },
    });
    await prisma.supportMessage.create({
      data: {
        enquiryId: enquiry.id,
        authorType: "SYSTEM",
        visibility: "INTERNAL",
        body: "Synthetic internal message",
      },
    });

    const initial = await support.customerMessages(actor(owner), "enquiry", enquiry.id, {
      limit: 50,
    });
    expect(initial.items.map((message) => message.id)).toEqual([first.id]);
    expect(initial.pollAfterMs).toBe(5_000);
    expect(
      await support.customerMessages(actor(owner), "enquiry", enquiry.id, {
        limit: 50,
        cursor: first.id,
      }),
    ).toMatchObject({ items: [], cursor: first.id, hasMore: false });
    await expect(
      support.customerMessages(actor(stranger), "enquiry", enquiry.id, { limit: 50 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      support.customerMessages(actor(owner), "enquiry", enquiry.id, {
        limit: 50,
        cursor: (
          await prisma.supportMessage.findFirstOrThrow({
            where: { enquiryId: enquiry.id, visibility: "INTERNAL" },
            select: { id: true },
          })
        ).id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    const administratorActor: AuthenticatedActor = {
      userId: randomUUID(),
      sessionId: randomUUID(),
      role: "ADMIN",
      email: "synthetic-chat-administrator@example.test",
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    };
    expect(
      (
        await support.staffMessages(administratorActor, "enquiry", enquiry.id, {
          limit: 50,
        })
      ).items,
    ).toHaveLength(2);
  }, 30_000);

  it("deduplicates notification creation and publishes a claimed delivery once", async () => {
    const recipient = await customer();
    const command = {
      userId: recipient.id,
      type: "SYSTEM" as const,
      category: "TRANSACTIONAL" as const,
      title: "Synthetic notification",
      message: "This message contains no real customer data.",
      deduplicationKey: `phase9:${randomUUID()}`,
    };
    const first = await prisma.$transaction((transaction) =>
      enqueueNotification(transaction, command),
    );
    const second = await prisma.$transaction((transaction) =>
      enqueueNotification(transaction, command),
    );
    expect(second.id).toBe(first.id);
    expect(
      await prisma.notification.count({
        where: { deduplicationKey: command.deduplicationKey },
      }),
    ).toBe(1);

    const eventId = randomUUID();
    await prisma.outboxEvent.create({
      data: {
        eventId,
        aggregateType: "Notification",
        aggregateId: first.id,
        eventType: "notification.delivery.requested",
        payload: {
          encrypted: encryptNotificationPayload({
            channel: "EMAIL",
            recipient: recipient.email,
            title: command.title,
            message: command.message,
          }),
        } as unknown as Prisma.InputJsonValue,
        notificationDelivery: {
          create: { notificationId: first.id, channel: "EMAIL" },
        },
      },
    });
    const sent: TransactionalEmail[] = [];
    const email: EmailProvider = {
      async send(message) {
        sent.push(message);
      },
    };
    const worker = new NotificationDeliveryWorker(email, null, prisma);
    expect(await worker.runOnce(10)).toBeGreaterThanOrEqual(1);
    expect(await worker.runOnce(10)).toBe(0);
    expect(sent.filter((message) => message.idempotencyKey === eventId)).toHaveLength(1);
  }, 30_000);

  it("classifies terminal and retryable notification provider failures", async () => {
    const recipient = await customer();
    const createDelivery = async (label: string) => {
      const notification = await prisma.notification.create({
        data: {
          userId: recipient.id,
          type: "SYSTEM",
          category: "TRANSACTIONAL",
          title: `Synthetic ${label}`,
          message: "Synthetic provider failure simulation",
        },
      });
      return prisma.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "Notification",
          aggregateId: notification.id,
          eventType: "notification.delivery.requested",
          availableAt: new Date("2000-01-01T00:00:00.000Z"),
          createdAt: new Date("2000-01-01T00:00:00.000Z"),
          payload: {
            encrypted: encryptNotificationPayload({
              channel: "EMAIL",
              recipient: recipient.email,
              title: notification.title,
              message: notification.message,
            }),
          } as unknown as Prisma.InputJsonValue,
          notificationDelivery: {
            create: { notificationId: notification.id, channel: "EMAIL" },
          },
        },
        select: { id: true },
      });
    };

    const terminal = await createDelivery("terminal failure");
    const terminalProvider: EmailProvider = {
      async send() {
        throw providerRejected();
      },
    };
    await new NotificationDeliveryWorker(terminalProvider, null, prisma).runOnce(1);
    expect(
      await prisma.outboxEvent.findUniqueOrThrow({ where: { id: terminal.id } }),
    ).toMatchObject({
      status: "DEAD_LETTER",
      attempts: 1,
      lastError: "NOTIFICATION_DELIVERY_REJECTED",
    });

    const retryable = await createDelivery("retryable failure");
    const retryableProvider: EmailProvider = {
      async send() {
        throw providerUnavailable();
      },
    };
    await new NotificationDeliveryWorker(retryableProvider, null, prisma).runOnce(1);
    expect(
      await prisma.outboxEvent.findUniqueOrThrow({ where: { id: retryable.id } }),
    ).toMatchObject({
      status: "FAILED",
      attempts: 1,
      lastError: "NOTIFICATION_DELIVERY_FAILED",
    });
  }, 30_000);

  it("expires an unpaid order and releases its inventory exactly once", async () => {
    const owner = await customer();
    const branch = await prisma.branch.create({
      data: {
        code: `P9-${randomUUID().slice(0, 8)}`,
        name: "Phase Nine Expiry Branch",
        address: "10 Synthetic Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const category = await prisma.category.create({
      data: { name: "Phase Nine Category", slug: `p9-category-${randomUUID()}` },
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: "Phase Nine Product",
        slug: `p9-product-${randomUUID()}`,
        sku: `P9-${randomUUID()}`,
        priceKobo: 25_000n,
      },
    });
    const inventory = await prisma.inventory.create({
      data: { productId: product.id, branchId: branch.id, quantity: 3, reserved: 1 },
    });
    const order = await prisma.order.create({
      data: {
        customerId: owner.profile!.id,
        branchId: branch.id,
        orderNumber: `P9-${randomUUID()}`,
        status: "PENDING",
        subtotalKobo: 25_000n,
        totalKobo: 25_000n,
        customerName: "Synthetic Customer",
        customerEmail: owner.email,
        customerPhone: "+2348000000000",
        paymentDueAt: new Date("2000-01-01T00:00:00.000Z"),
      },
    });
    const reservation = await prisma.inventoryReservation.create({
      data: {
        inventoryId: inventory.id,
        customerId: owner.profile!.id,
        quantity: 1,
        createdAt: new Date("1999-12-31T23:00:00.000Z"),
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
        idempotencyKey: `p9-${randomUUID()}`,
        requestHash: "a".repeat(64),
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });
    const orders = new OrdersService(prisma);
    expect((await orders.expireDueSystem(100)).expired).toBeGreaterThanOrEqual(1);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("CANCELLED");
    expect(
      (await prisma.inventory.findUniqueOrThrow({ where: { id: inventory.id } }))
        .reserved,
    ).toBe(0);
    expect(
      await prisma.inventoryTransaction.count({
        where: { referenceId: order.id, type: "RESERVATION_RELEASE" },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.inventoryReservation.findUniqueOrThrow({
          where: { id: reservation.id },
        })
      ).status,
    ).toBe("RELEASED");
    expect((await orders.expireDueSystem(100)).expired).toBe(0);
  }, 30_000);

  it("exposes no job payload and audits controlled retries and anomaly transitions", async () => {
    const administratorId = randomUUID();
    const administrator = await prisma.user.create({
      data: {
        id: administratorId,
        email: `phase9-ops-${administratorId}@example.test`,
        passwordHash: "synthetic-not-an-authentication-fixture",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        staffProfile: { create: { firstName: "Synthetic", lastName: "Operator" } },
      },
      select: { id: true, email: true },
    });
    const administratorActor: AuthenticatedActor = {
      ...actor(administrator),
      role: "ADMIN",
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    };
    const outbox = await prisma.outboxEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: "Synthetic",
        aggregateId: randomUUID(),
        eventType: "synthetic.failed",
        payload: { mustNeverAppearInOperationsApi: "synthetic-sensitive-marker" },
        status: "DEAD_LETTER",
        attempts: 8,
        lastError: "SYNTHETIC_FAILURE",
      },
    });
    const operations = new AuditOperationsService(prisma);
    const jobs = await operations.jobs(administratorActor, {
      limit: 100,
      source: "OUTBOX",
      status: "DEAD_LETTER",
    });
    expect(jobs.items.some((job) => job.id === outbox.id)).toBe(true);
    expect(JSON.stringify(jobs)).not.toContain("synthetic-sensitive-marker");
    await operations.retryJob(
      administratorActor,
      "outbox",
      outbox.id,
      { expectedAttempts: 8, reason: "Synthetic controlled retry test" },
      context,
    );
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outbox.id } })).status,
    ).toBe("PENDING");

    const anomalyOwner = await customer();
    const anomalyBranch = await prisma.branch.create({
      data: {
        code: `P9-OPS-${randomUUID().slice(0, 8)}`,
        name: "Phase Nine Operations Branch",
        address: "9 Operations Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const anomalyOrder = await prisma.order.create({
      data: {
        customerId: anomalyOwner.profile!.id,
        branchId: anomalyBranch.id,
        orderNumber: `P9-OPS-${randomUUID().slice(0, 24)}`,
        status: "PENDING",
        subtotalKobo: 10_000n,
        totalKobo: 10_000n,
        customerName: "Synthetic Customer",
        customerEmail: anomalyOwner.email,
        customerPhone: "+2348000000000",
        paymentDueAt: new Date(Date.now() + 1_800_000),
      },
    });
    const anomalyPayment = await prisma.payment.create({
      data: {
        customerId: anomalyOwner.profile!.id,
        orderId: anomalyOrder.id,
        paymentNumber: `P9-OPS-PAY-${randomUUID()}`,
        purpose: "ORDER_PAYMENT",
        amountKobo: 10_000n,
        idempotencyKeyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
      },
    });
    const anomaly = await prisma.paymentAnomaly.create({
      data: {
        paymentId: anomalyPayment.id,
        type: "OTHER",
        summary: "Synthetic operational anomaly",
      },
    });
    await operations.updateAnomaly(
      administratorActor,
      anomaly.id,
      {
        expectedStatus: "OPEN",
        status: "INVESTIGATING",
        resolutionNote: "Synthetic investigation started",
      },
      context,
    );
    const resolved = await operations.updateAnomaly(
      administratorActor,
      anomaly.id,
      {
        expectedStatus: "INVESTIGATING",
        status: "RESOLVED",
        resolutionNote: "Synthetic evidence reconciled",
      },
      context,
    );
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.resolvedByUserId).toBe(administrator.id);
  }, 30_000);

  it("records a late capture without reviving an expired order", async () => {
    const owner = await customer();
    const reviewerId = randomUUID();
    const reviewer = await prisma.user.create({
      data: {
        id: reviewerId,
        email: `phase9-reviewer-${reviewerId}@example.test`,
        passwordHash: "synthetic-not-an-authentication-fixture",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        staffProfile: { create: { firstName: "Synthetic", lastName: "Reviewer" } },
      },
      select: { id: true, email: true },
    });
    const branch = await prisma.branch.create({
      data: {
        code: `P9-LATE-${randomUUID().slice(0, 8)}`,
        name: "Phase Nine Late Payment Branch",
        address: "9 Settlement Road",
        city: "Lagos",
        state: "Lagos",
      },
    });
    const order = await prisma.order.create({
      data: {
        customerId: owner.profile!.id,
        branchId: branch.id,
        orderNumber: `P9-LATE-${randomUUID().slice(0, 24)}`,
        status: "CANCELLED",
        subtotalKobo: 10_000n,
        totalKobo: 10_000n,
        customerName: "Synthetic Customer",
        customerEmail: owner.email,
        customerPhone: "+2348000000000",
        paymentDueAt: new Date("2000-01-01T00:00:00.000Z"),
        cancelledAt: new Date(),
        cancellationReason: "PAYMENT_WINDOW_EXPIRED",
      },
    });
    const payment = await prisma.payment.create({
      data: {
        customerId: owner.profile!.id,
        orderId: order.id,
        paymentNumber: `P9-PAY-${randomUUID()}`,
        purpose: "ORDER_PAYMENT",
        amountKobo: 10_000n,
        idempotencyKeyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        status: "REQUIRES_REVIEW",
      },
    });
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        internalReference: `P9-MANUAL-${randomUUID()}`,
        provider: "MANUAL",
        method: "BANK_TRANSFER",
        status: "PENDING",
        amountKobo: 10_000n,
        manualReview: {
          create: {
            submittedByUserId: owner.id,
            bankReference: `P9-BANK-${randomUUID()}`,
            payerName: "Synthetic Customer",
            transferredAt: new Date(),
          },
        },
      },
    });
    const reviewerActor: AuthenticatedActor = {
      ...actor(reviewer),
      role: "ADMIN",
      mfaRequired: true,
      mfaVerifiedAt: new Date(),
    };
    await new PaymentsService(prisma).reviewManual(
      reviewerActor,
      attempt.id,
      { decision: "APPROVED", reviewerNote: "Synthetic independent evidence" },
      context,
    );
    const [storedOrder, anomaly, ledger] = await Promise.all([
      prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      prisma.paymentAnomaly.findFirst({
        where: { paymentId: payment.id, type: "LATE_SUCCESS" },
      }),
      prisma.paymentLedgerEntry.count({ where: { paymentAttemptId: attempt.id } }),
    ]);
    expect(storedOrder.status).toBe("CANCELLED");
    expect(storedOrder.paidAt).toBeNull();
    expect(anomaly).not.toBeNull();
    expect(ledger).toBe(1);
  }, 30_000);
  it("rechecks withdrawn optional consent at dispatch while essential delivery remains available", async () => {
    const recipient = await customer();
    await prisma.notificationPreference.create({
      data: {
        userId: recipient.id,
        category: "OPERATIONAL",
        channel: "EMAIL",
        enabled: false,
      },
    });
    const events = [];
    for (const category of ["OPERATIONAL", "TRANSACTIONAL", "MARKETING"] as const) {
      const notification = await prisma.notification.create({
        data: {
          userId: recipient.id,
          type: "SYSTEM",
          category,
          title: "Synthetic consent contract",
          message: "Synthetic consent contract",
        },
      });
      const event = await prisma.outboxEvent.create({
        data: {
          eventId: randomUUID(),
          aggregateType: "Notification",
          aggregateId: notification.id,
          eventType: "notification.delivery.requested",
          availableAt: new Date("1990-01-01Z"),
          createdAt: new Date("1990-01-01Z"),
          payload: {
            encrypted: encryptNotificationPayload({
              channel: "EMAIL",
              recipient: recipient.email,
              title: notification.title,
              message: notification.message,
            }),
          } as unknown as Prisma.InputJsonValue,
          notificationDelivery: {
            create: { notificationId: notification.id, channel: "EMAIL" },
          },
        },
      });
      events.push(event);
    }
    const sent: TransactionalEmail[] = [];
    await new NotificationDeliveryWorker(
      {
        async send(message) {
          sent.push(message);
        },
      },
      null,
      prisma,
    ).runOnce(3);
    expect(sent.map((message) => message.idempotencyKey)).toEqual([events[1]!.eventId]);
    expect(
      await prisma.outboxEvent.findUnique({ where: { id: events[0]!.id } }),
    ).toMatchObject({ status: "DEAD_LETTER", lastError: "CONSENT_WITHDRAWN" });
    expect(
      await prisma.outboxEvent.findUnique({ where: { id: events[2]!.id } }),
    ).toMatchObject({ status: "DEAD_LETTER", lastError: "MARKETING_DISABLED" });
  });
});
