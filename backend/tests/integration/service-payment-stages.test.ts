import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { BillingService } from "../../src/modules/billing/billing.service.js";
import { FinancialDocumentsService } from "../../src/modules/billing/documents.service.js";
import { ServiceOperationsService } from "../../src/modules/service-operations/service-operations.service.js";
import { assertAgreedWorkCanProceed } from "../../src/modules/service-operations/agreed-service-work.js";
import { WorkforceWorkService } from "../../src/modules/organization/workforce-work.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { servicePaymentPlanFromSnapshot } from "../../src/modules/billing/service-payment-plan.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function fixture(legacyCredit = false) {
  const branch = await prisma.branch.create({
    data: {
      code: `D03-${randomUUID().slice(0, 8)}`,
      name: "Synthetic service stage",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const customer = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Synthetic", lastName: "Stage", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const admin = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      role: "ADMIN",
      emailVerifiedAt: new Date(),
      staffProfile: {
        create: { firstName: "Synthetic", lastName: "Operator", branchId: branch.id },
      },
    },
    include: { staffProfile: true },
  });
  const actor: AuthenticatedActor = {
    userId: customer.id,
    email: customer.email,
    role: "CUSTOMER",
    sessionId: await paymentTestSession(customer.id),
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
  const operator: AuthenticatedActor = {
    userId: admin.id,
    email: admin.email,
    role: "ADMIN",
    sessionId: await paymentTestSession(admin.id, "ADMIN"),
    mfaRequired: true,
    mfaVerifiedAt: new Date(),
  };
  const service = await prisma.service.create({
    data: {
      name: "Synthetic stage service",
      slug: randomUUID(),
      pricingType: "FIXED",
      priceKobo: 10000n,
    },
  });
  const product = await prisma.product.create({
    data: {
      name: "Synthetic material",
      sku: randomUUID(),
      slug: randomUUID(),
      priceKobo: 10000n,
      category: { create: { name: "Synthetic D03 materials", slug: randomUUID() } },
    },
  });
  const booking = await prisma.booking.create({
    data: {
      customerId: customer.profile!.id,
      branchId: branch.id,
      serviceId: service.id,
      scheduledAt: new Date(Date.now() + 3600000),
      status: "CONFIRMED",
      confirmedAt: new Date(),
      quotedPriceKobo: 20000n,
    },
  });
  const quote = await prisma.serviceQuote.create({
    data: {
      bookingId: booking.id,
      createdByStaffId: admin.staffProfile!.id,
      quoteNumber: `D03-${randomUUID().slice(0, 20)}`,
      status: "DRAFT",
      subtotalKobo: 20000n,
      taxKobo: 1500n,
      totalKobo: 21500n,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      items: {
        create: [
          {
            type: "PART",
            productId: product.id,
            description: "Synthetic material",
            quantity: 1,
            unitPriceKobo: 10000n,
            subtotalKobo: 10000n,
          },
          {
            type: "LABOUR",
            description: "Synthetic workmanship",
            quantity: 1,
            unitPriceKobo: 10000n,
            subtotalKobo: 10000n,
          },
        ],
      },
    },
  });
  await prisma.serviceQuote.update({
    where: { id: quote.id },
    data: { status: "ISSUED", issuedAt: new Date() },
  });
  await prisma.serviceQuote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  if (legacyCredit) {
    // Historical fixture only: no new deposit endpoint is enabled or called.
    const timedService = await prisma.service.update({
      where: { id: service.id },
      data: {
        durationMinutes: 30,
        preparationMinutes: 0,
        cleanupMinutes: 0,
      },
    });
    const slot = await prisma.bookingSlot.create({
      data: {
        branchId: branch.id,
        serviceId: service.id,
        staffId: admin.staffProfile!.id,
        durationMinutes: 30,
        preparationMinutes: 0,
        cleanupMinutes: 0,
        serviceTimingVersion: timedService.timingVersion,
        startsAt: booking.scheduledAt,
        endsAt: new Date(booking.scheduledAt.getTime() + 1800000),
      },
    });
    const at = new Date(Math.max(Date.now(), booking.createdAt.getTime() + 1));
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        bookingSlotId: slot.id,
        assignedStaffId: admin.staffProfile!.id,
        depositBaseKobo: 20000n,
        depositBasisPoints: 3000,
        depositAmountKobo: 6000n,
        depositPolicyVersion: "synthetic-legacy-v1",
        depositTermsAcceptedAt: at,
        paymentHoldExpiresAt: new Date(Date.now() + 3600000),
        depositPaidAt: at,
      },
    });
    const payment = await prisma.payment.create({
      data: {
        customerId: customer.profile!.id,
        bookingId: booking.id,
        paymentNumber: `D03-OLD-${randomUUID()}`,
        purpose: "BOOKING_DEPOSIT",
        amountKobo: 6000n,
        idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
      },
    });
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        internalReference: `D03-OLD-${randomUUID()}`,
        provider: "PAYSTACK",
        amountKobo: 6000n,
        providerReference: `synthetic-legacy-${randomUUID()}`,
        gatewayTransactionId: `synthetic-legacy-${randomUUID()}`,
        status: "SUCCESSFUL",
        verificationStatus: "VERIFIED",
        verifiedAmountKobo: 6000n,
        verifiedCurrency: "NGN",
        verifiedAt: at,
        paidAt: at,
      },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCEEDED", settledAttemptId: attempt.id, succeededAt: at },
    });
  }
  const billing = new BillingService(prisma);
  await billing.create(
    operator,
    { sourceType: "BOOKING", sourceId: booking.id },
    context(),
  );
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { bookingId: booking.id },
  });
  await billing.issue(operator, invoice.id, { expectedVersion: 0 }, context());
  const provider: PaymentProviderPort = {
    async initialize() {
      throw new Error("No real checkout allowed");
    },
    async verify(reference) {
      const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
        where: { internalReference: reference },
      });
      return {
        reference,
        gatewayTransactionId: `synthetic-${reference}`,
        status: "success",
        amountKobo: attempt.amountKobo,
        currency: "NGN",
        paidAt: new Date(),
        providerFeeKobo: 0n,
        method: "card",
      };
    },
    async refund() {
      throw new Error("No real refund allowed");
    },
  };
  const payments = new PaymentsService(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: provider, MONNIFY: provider }),
  );
  async function input(stage: "MATERIALS" | "WORKMANSHIP", amountKobo?: string) {
    const current = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    const plan = servicePaymentPlanFromSnapshot(current.documentSnapshot, current)!;
    return {
      targetType: "INVOICE" as const,
      targetId: invoice.id,
      purpose: "SERVICE_INVOICE" as const,
      acceptedServiceStage: {
        stage,
        invoiceVersion: current.version,
        amountKobo:
          amountKobo ??
          (stage === "MATERIALS" ? plan.materials.totalKobo : plan.workmanship.totalKobo),
      },
    };
  }
  async function create(stage: "MATERIALS" | "WORKMANSHIP", key = randomUUID()) {
    await payments.createIntent(actor, await input(stage), key, context());
    return prisma.payment.findFirstOrThrow({
      where: { invoiceId: invoice.id },
      orderBy: { createdAt: "desc" },
    });
  }
  async function capture(paymentId: string) {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const attempt = await prisma.paymentAttempt.create({
      data: {
        paymentId,
        attemptNumber: 1,
        internalReference: `D03-${randomUUID()}`,
        provider: "PAYSTACK",
        status: "PENDING",
        amountKobo: payment.amountKobo,
      },
    });
    await payments.verifyAttempt(actor, paymentId, attempt.id, context());
    return attempt;
  }
  async function complete() {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "COMPLETED",
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date(),
      },
    });
  }
  return {
    product,
    quote,
    invoice,
    booking,
    actor,
    operator,
    billing,
    payments,
    input,
    create,
    capture,
    complete,
  };
}

async function agreedWork(f: Awaited<ReturnType<typeof fixture>>, materials = true) {
  const operations = new ServiceOperationsService(prisma);
  const work = await operations.createWorkOrder(
    f.operator,
    f.booking.id,
    {
      expectedBookingVersion: 0,
      items: [
        ...(materials
          ? [{ type: "PART" as const, productId: f.product.id, quantity: 1 }]
          : []),
        {
          type: "LABOUR",
          description: "Synthetic workmanship",
          quantity: 1,
          unitPriceKobo: "10000",
        },
      ],
    },
    context(),
  );
  return { operations, work };
}
async function checkWork(bookingId: string, complete = false) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId}::uuid FOR UPDATE`;
    await assertAgreedWorkCanProceed(tx, bookingId, complete);
  });
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "synthetic D03 service payment stages on an isolated database",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    it("honours a genuine historical credit once and refuses a later forfeiture", async () => {
      const f = await fixture(true);
      await agreedWork(f);
      const payment = await f.create("MATERIALS");
      expect(payment.amountKobo).toBe(7750n);
      await f.capture(payment.id);
      await expect(checkWork(f.booking.id)).resolves.toBeUndefined();
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { depositForfeitedAt: new Date() },
      });
      await expect(checkWork(f.booking.id)).rejects.toThrow(
        /credit needs financial review/,
      );
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ totalKobo: 15500n, depositCreditKobo: 6000n });
    });
    it("prices work from the accepted scope despite a later catalogue-price change", async () => {
      const f = await fixture();
      await prisma.product.update({
        where: { id: f.product.id },
        data: { priceKobo: 99999n, name: "Later catalogue name" },
      });
      const { work } = await agreedWork(f);
      expect(work.items.find((line) => line.type === "PART")).toMatchObject({
        description: "Synthetic material",
        unitPriceKobo: "10000",
        subtotalKobo: "10000",
      });
      expect(await prisma.invoice.count({ where: { bookingId: f.booking.id } })).toBe(1);
    });
    it("refuses extras and duplicate quantities without editing the work order or invoice", async () => {
      const f = await fixture(),
        { operations, work } = await agreedWork(f);
      for (const addItems of [
        [{ type: "PART" as const, productId: f.product.id, quantity: 1 }],
        [
          {
            type: "FEE" as const,
            description: "Unaccepted extra",
            quantity: 1,
            unitPriceKobo: "500",
          },
        ],
        [
          {
            type: "LABOUR" as const,
            description: "Synthetic workmanship",
            quantity: 1,
            unitPriceKobo: "9999",
          },
        ],
      ])
        await expect(
          operations.updateWorkOrder(
            f.operator,
            f.booking.id,
            work.id,
            { expectedVersion: 0, addItems },
            context(),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.workOrder.findUniqueOrThrow({
          where: { id: work.id },
          include: { items: true },
        }),
      ).toMatchObject({ version: 0, items: expect.any(Array) });
      expect(await prisma.workOrderItem.count({ where: { workOrderId: work.id } })).toBe(
        2,
      );
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ totalKobo: 21500n, version: 1 });
    });
    it("blocks both direct-booking and work-order starts before verified materials payment", async () => {
      const f = await fixture(),
        { operations, work } = await agreedWork(f);
      await operations.transitionWorkOrder(
        f.operator,
        f.booking.id,
        work.id,
        { status: "APPROVED", expectedVersion: 0 },
        context(),
      );
      await expect(
        operations.transitionWorkOrder(
          f.operator,
          f.booking.id,
          work.id,
          { status: "IN_PROGRESS", expectedVersion: 1 },
          context(),
        ),
      ).rejects.toThrow(/materials payment must be verified/);
      await expect(
        operations.transitionBooking(
          f.operator,
          f.booking.id,
          { status: "IN_PROGRESS", expectedVersion: 0 },
          context(),
        ),
      ).rejects.toThrow(/materials payment must be verified/);
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({ status: "CONFIRMED", startedAt: null, version: 0 });
      expect(
        await prisma.workOrder.findUniqueOrThrow({ where: { id: work.id } }),
      ).toMatchObject({ status: "APPROVED", startedAt: null, version: 1 });
      expect(
        await prisma.bookingResourceAllocation.count({
          where: { bookingId: f.booking.id },
        }),
      ).toBe(0);
    });
    it("allows agreed labour first but requires complete scope and verified materials for completion", async () => {
      const f = await fixture(),
        { operations, work } = await agreedWork(f, false);
      await expect(checkWork(f.booking.id)).resolves.toBeUndefined();
      await expect(checkWork(f.booking.id, true)).rejects.toThrow(/all agreed work/);
      await operations.updateWorkOrder(
        f.operator,
        f.booking.id,
        work.id,
        {
          expectedVersion: 0,
          addItems: [{ type: "PART", productId: f.product.id, quantity: 1 }],
        },
        context(),
      );
      await expect(checkWork(f.booking.id)).rejects.toThrow(
        /materials payment must be verified/,
      );
      const payment = await f.create("MATERIALS");
      await expect(checkWork(f.booking.id)).rejects.toThrow(
        /materials payment must be verified/,
      );
      await f.capture(payment.id);
      await expect(checkWork(f.booking.id, true)).resolves.toBeUndefined();
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ status: "ISSUED" });
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(1);
    });
    it("does not add unpaid materials to active work, while keeping diagnosis updates available", async () => {
      const f = await fixture(),
        { operations, work } = await agreedWork(f, false);
      await prisma.workOrder.update({
        where: { id: work.id },
        data: { startedAt: new Date(), status: "IN_PROGRESS" },
      });
      await expect(
        operations.updateWorkOrder(
          f.operator,
          f.booking.id,
          work.id,
          {
            expectedVersion: 0,
            addItems: [{ type: "PART", productId: f.product.id, quantity: 1 }],
          },
          context(),
        ),
      ).rejects.toThrow(/materials payment must be verified/);
      await operations.updateWorkOrder(
        f.operator,
        f.booking.id,
        work.id,
        {
          expectedVersion: 0,
          diagnosis: "Synthetic technical observation, no scope change",
        },
        context(),
      );
      expect(await prisma.workOrderItem.count({ where: { workOrderId: work.id } })).toBe(
        1,
      );
    });
    it("holds work when settled materials need financial reconciliation", async () => {
      const f = await fixture();
      await agreedWork(f);
      const payment = await f.create("MATERIALS"),
        attempt = await f.capture(payment.id);
      await prisma.paymentAnomaly.create({
        data: {
          paymentId: payment.id,
          paymentAttemptId: attempt.id,
          type: "DUPLICATE_SUCCESS",
          summary: "Synthetic financial hold",
        },
      });
      await expect(checkWork(f.booking.id)).rejects.toThrow(/financial review/);
    });
    it("enforces the same materials boundary on a managed job without expanding customer access", async () => {
      const f = await fixture(),
        { operations, work } = await agreedWork(f);
      await operations.transitionWorkOrder(
        f.operator,
        f.booking.id,
        work.id,
        { status: "APPROVED", expectedVersion: 0 },
        context(),
      );
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      await prisma.workforceAccess.create({
        data: {
          userId: f.operator.userId,
          position: "WORKSHOP_LEAD",
          updatedByUserId: f.operator.userId,
          assignments: {
            create: {
              template: "WORKSHOP_LEAD",
              branchId: booking.branchId!,
              scope: "BRANCH",
              startsAt: new Date(Date.now() - 1000),
              reason: "Synthetic D03 managed-work acceptance",
              assignedByUserId: f.operator.userId,
            },
          },
        },
      });
      const managed = new WorkforceWorkService();
      await expect(
        managed.work(
          f.actor,
          f.booking.id,
          { status: "IN_PROGRESS", expectedVersion: 1 },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        managed.work(
          f.operator,
          f.booking.id,
          { status: "IN_PROGRESS", expectedVersion: 1 },
          context(),
        ),
      ).rejects.toThrow(/materials payment must be verified/);
      expect(
        await prisma.workOrder.findUniqueOrThrow({ where: { id: work.id } }),
      ).toMatchObject({ status: "APPROVED", version: 1, startedAt: null });
    });
    it("permits independent managed quality completion after materials settlement, leaving workmanship due", async () => {
      const f = await fixture(),
        { work } = await agreedWork(f);
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      const reviewer = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-only",
          role: "STAFF",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: {
              firstName: "Synthetic",
              lastName: "Independent reviewer",
              branchId: booking.branchId,
            },
          },
        },
      });
      await prisma.workforceAccess.create({
        data: {
          userId: reviewer.id,
          position: "WORKSHOP_LEAD",
          updatedByUserId: f.operator.userId,
          assignments: {
            create: {
              template: "WORKSHOP_LEAD",
              branchId: booking.branchId!,
              scope: "BRANCH",
              startsAt: new Date(Date.now() - 1000),
              reason: "Synthetic independent D03 review",
              assignedByUserId: f.operator.userId,
            },
          },
        },
      });
      const actor: AuthenticatedActor = {
        ...f.operator,
        userId: reviewer.id,
        email: reviewer.email,
        role: "STAFF",
        sessionId: await paymentTestSession(reviewer.id, "STAFF"),
      };
      await prisma.booking.update({
        where: { id: f.booking.id },
        data: { status: "IN_PROGRESS", startedAt: new Date(Date.now() - 1000) },
      });
      await prisma.workOrder.update({
        where: { id: work.id },
        data: {
          status: "QUALITY_CHECK",
          startedAt: new Date(Date.now() - 1000),
          workedByUserIds: [f.operator.userId],
        },
      });
      const managed = new WorkforceWorkService(),
        input = {
          expectedVersion: 0,
          reason: "Synthetic independent completed-work inspection",
        };
      await expect(
        managed.quality(actor, f.booking.id, input, context()),
      ).rejects.toThrow(/materials payment must be verified/);
      const payment = await f.create("MATERIALS");
      await f.capture(payment.id);
      await managed.quality(actor, f.booking.id, input, context());
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({ status: "COMPLETED", completedAt: expect.any(Date) });
      expect(
        await prisma.workOrder.findUniqueOrThrow({ where: { id: work.id } }),
      ).toMatchObject({ status: "COMPLETED", qualityApprovedByUserId: reviewer.id });
      expect(await f.billing.customerGet(f.actor, f.invoice.id)).toMatchObject({
        servicePayment: { nextPayment: { stage: "WORKMANSHIP", amountKobo: "10750" } },
      });
    });
    it("refuses a busy verification proof promptly instead of deadlocking Booking against Attempt", async () => {
      const f = await fixture();
      await agreedWork(f);
      const payment = await f.create("MATERIALS"),
        attempt = await f.capture(payment.id);
      let unlock!: () => void, locked!: () => void;
      const ready = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const release = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const holder = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${attempt.id}::uuid FOR UPDATE`;
        locked();
        await release;
      });
      await ready;
      try {
        await expect(checkWork(f.booking.id)).rejects.toThrow(/being updated/);
      } finally {
        unlock();
        await holder;
      }
      await expect(checkWork(f.booking.id)).resolves.toBeUndefined();
    });
    it("snapshots one accepted sale with exact materials and workmanship obligations", async () => {
      const f = await fixture();
      const plan = servicePaymentPlanFromSnapshot(f.invoice.documentSnapshot, f.invoice)!;
      expect(plan.materials.totalKobo).toBe("10750");
      expect(plan.workmanship.totalKobo).toBe("10750");
      expect(await prisma.invoice.count({ where: { bookingId: f.booking.id } })).toBe(1);
    });
    it("rejects an omitted stage, stale review, wrong amount and premature workmanship without writes", async () => {
      const f = await fixture();
      for (const body of [
        {
          targetType: "INVOICE" as const,
          targetId: f.invoice.id,
          purpose: "SERVICE_INVOICE" as const,
        },
        {
          ...(await f.input("MATERIALS")),
          acceptedServiceStage: {
            stage: "MATERIALS" as const,
            invoiceVersion: 0,
            amountKobo: "10750",
          },
        },
        await f.input("MATERIALS", "21500"),
        await f.input("WORKMANSHIP"),
      ])
        await expect(
          f.payments.createIntent(f.actor, body, randomUUID(), context()),
        ).rejects.toMatchObject({ statusCode: 409 });
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(0);
    });
    it("settles materials without marking workmanship or the invoice paid", async () => {
      const f = await fixture(),
        payment = await f.create("MATERIALS");
      await f.capture(payment.id);
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ status: "ISSUED", paidAt: null, version: 2, totalKobo: 21500n });
      await expect(f.create("WORKMANSHIP")).rejects.toMatchObject({ statusCode: 409 });
    });
    it("charges only the remaining workmanship after completion and settles once", async () => {
      const f = await fixture();
      const material = await f.create("MATERIALS");
      await f.capture(material.id);
      await f.complete();
      const labour = await f.create("WORKMANSHIP");
      expect(labour.amountKobo).toBe(10750n);
      await f.capture(labour.id);
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ status: "PAID", version: 3 });
      expect(
        (
          await prisma.payment.aggregate({
            where: { invoiceId: f.invoice.id, status: "SUCCEEDED" },
            _sum: { amountKobo: true },
          })
        )._sum.amountKobo,
      ).toBe(21500n);
    });
    it("replays the original accepted stage after success and rejects a changed idempotent request", async () => {
      const f = await fixture(),
        key = randomUUID(),
        body = await f.input("MATERIALS");
      await f.payments.createIntent(f.actor, body, key, context());
      const payment = await prisma.payment.findFirstOrThrow({
        where: { invoiceId: f.invoice.id },
      });
      await f.capture(payment.id);
      expect(await f.payments.createIntent(f.actor, body, key, context())).toMatchObject({
        replayed: true,
      });
      await expect(
        f.payments.createIntent(
          f.actor,
          {
            ...body,
            acceptedServiceStage: { ...body.acceptedServiceStage, stage: "WORKMANSHIP" },
          },
          key,
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(1);
    });
    it("serializes competing materials requests rather than creating duplicate obligations", async () => {
      const f = await fixture();
      const body = await f.input("MATERIALS");
      const outcomes = await Promise.allSettled(
        [1, 2].map(() => f.payments.createIntent(f.actor, body, randomUUID(), context())),
      );
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(1);
    });
    it("records a late capture for a void stage as money requiring reconciliation", async () => {
      const f = await fixture(),
        payment = await f.create("MATERIALS");
      await f.billing.void(f.operator, f.invoice.id, { expectedVersion: 1 }, context());
      const attempt = await f.capture(payment.id);
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
      ).toMatchObject({ status: "REQUIRES_REVIEW", settledAttemptId: null });
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttemptId: attempt.id, type: "CAPTURE" },
        }),
      ).toBe(1);
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ status: "VOID" });
    });
    it("returns private-safe live stages and stage-labelled invoice documents and receipts", async () => {
      const f = await fixture(),
        documents = new FinancialDocumentsService(prisma);
      const payment = await f.create("MATERIALS");
      await f.capture(payment.id);
      const detail = await f.billing.customerGet(f.actor, f.invoice.id);
      expect(detail).toMatchObject({
        status: "ISSUED",
        servicePayment: {
          materials: { recordedKobo: "10750" },
          paymentPending: false,
          nextPayment: null,
        },
        payments: [{ serviceStage: "MATERIALS" }],
      });
      const json = JSON.stringify(detail);
      for (const field of [
        "documentSnapshot",
        "policySnapshot",
        "quoteId",
        "settledAttempt",
        "anomalies",
      ])
        expect(json).not.toContain(field);
      const paper = await documents.invoice(f.actor, f.invoice.id);
      expect(paper.servicePaymentPlan?.materials.totalKobo).toBe("10750");
      expect(paper.receipts[0]?.serviceStage).toBe("MATERIALS");
      expect(paper.paymentRequests[0]?.serviceStage).toBe("MATERIALS");
      expect(await documents.receipt(f.actor, payment.id)).toMatchObject({
        serviceStage: "MATERIALS",
        amountKobo: "10750",
        refundedKobo: "0",
      });
      await f.complete();
      expect(await f.billing.customerGet(f.actor, f.invoice.id)).toMatchObject({
        servicePayment: {
          nextPayment: { stage: "WORKMANSHIP", invoiceVersion: 2, amountKobo: "10750" },
        },
      });
      const other = await fixture();
      await expect(
        f.billing.customerGet(other.actor, f.invoice.id),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(documents.receipt(other.actor, payment.id)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
    it("blocks the next stage and shows review when a real stored payment anomaly is unresolved", async () => {
      const f = await fixture(),
        payment = await f.create("MATERIALS"),
        attempt = await f.capture(payment.id);
      await f.complete();
      await prisma.paymentAnomaly.create({
        data: {
          paymentId: payment.id,
          paymentAttemptId: attempt.id,
          type: "DUPLICATE_SUCCESS",
          summary: "Synthetic adjustment requiring operator reconciliation",
        },
      });
      await expect(f.create("WORKMANSHIP")).rejects.toMatchObject({ statusCode: 409 });
      expect(await f.billing.customerGet(f.actor, f.invoice.id)).toMatchObject({
        servicePayment: { financialReviewRequired: true, nextPayment: null },
      });
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(1);
    });
  },
);
