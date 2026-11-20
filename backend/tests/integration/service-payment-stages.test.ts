import { renderFinancialPdf } from "../../src/modules/billing/document-pdf.js";
import {
  financeScope,
  workforceFinanceSelect,
  projectWorkforcePayment,
} from "../../src/modules/organization/workforce-finance-workspace.js";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { hashToken } from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { buildInvoiceSnapshot } from "../../src/modules/billing/document-snapshot.js";
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
  const currentBooking = await prisma.booking.findUniqueOrThrow({
    where: { id: f.booking.id },
  });
  const work = await operations.createWorkOrder(
    f.operator,
    f.booking.id,
    {
      expectedBookingVersion: currentBooking.version,
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
async function testHeaders(actor: AuthenticatedActor) {
  const token = randomUUID(),
    csrf = randomUUID().repeat(2),
    expiry = new Date(Date.now() + 3600000);
  await prisma.session.create({
    data: {
      userId: actor.userId,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      expiresAt: expiry,
      idleExpiresAt: expiry,
      createdAt: new Date(
        Math.min(Date.now() - 1000, actor.mfaVerifiedAt?.getTime() ?? Date.now() - 1000),
      ),
      mfaRequired: actor.role !== "CUSTOMER",
      mfaVerifiedAt: actor.mfaVerifiedAt,
    },
  });
  return {
    Cookie: `${sessionCookieName}=${token}`,
    Origin: env.FRONTEND_URL[0]!,
    "x-csrf-token": csrf,
  };
}

async function additionalQuote(
  f: Awaited<ReturnType<typeof fixture>>,
  reason = "Synthetic additional inspection requested after the original agreement",
  materials = false,
) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
  const operations = new ServiceOperationsService(prisma);
  const body = {
    items: [
      ...(materials
        ? [{ type: "PART" as const, productId: f.product.id, quantity: 1 }]
        : []),
      {
        type: "LABOUR" as const,
        description: "Additional inspection",
        quantity: 1,
        unitPriceKobo: "5000",
      },
    ],
    taxKobo: "0",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    additionalWork: { expectedBookingVersion: booking.version, reason },
  };
  const quote = (await operations.createQuote(
    f.operator,
    f.booking.id,
    body,
    context(),
  )) as {
    id: string;
    revision: number;
    version: number;
    originalInvoice: { invoiceNumber: string };
    amendmentReason: string;
  };
  return { operations, body, quote };
}

function additionalConsent(
  quote: {
    version: number;
    originalInvoice: { invoiceNumber: string };
    amendmentReason: string;
  },
  revision = 1,
) {
  return {
    expectedRevision: revision,
    acceptedAdditionalWork: {
      invoiceNumber: quote.originalInvoice.invoiceNumber,
      quoteVersion: quote.version,
      reason: quote.amendmentReason,
    },
  };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "synthetic D03 service payment stages on an isolated database",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
    async function collectionFixture() {
      const f = await fixture(true),
        { operations, work } = await agreedWork(f);
      const materials = await f.create("MATERIALS");
      await f.capture(materials.id);
      await prisma.workOrder.update({
        where: { id: work.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await f.complete();
      const labour = await f.create("WORKMANSHIP");
      await f.capture(labour.id);
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      const review = await operations.reviewVehicleRelease(f.operator, f.booking.id);
      return {
        ...f,
        operations,
        work,
        labour,
        body: {
          expectedBookingVersion: booking.version,
          financialReviewHash: review.financialReviewHash,
          idempotencyKey: randomUUID(),
          recipientName: "Synthetic collector",
          verificationNote:
            "Synthetic in-person identity and collection authority verified",
          identityAndAuthorityVerified: true as const,
        },
      };
    }
    it("records one cleared physical collection, preserves invoices and rejects replay changes or history rewriting", async () => {
      const f = await collectionFixture();
      await expect(
        f.operations.releaseCompletedVehicle(
          f.operator,
          f.booking.id,
          { ...f.body, financialReviewHash: "0".repeat(64) },
          context(),
        ),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining("financial review changed"),
      });
      const before = await prisma.invoice.findUniqueOrThrow({
        where: { id: f.invoice.id },
      });
      const result = await f.operations.releaseCompletedVehicle(
        f.operator,
        f.booking.id,
        f.body,
        context(),
      );
      expect(result).toMatchObject({
        bookingId: f.booking.id,
        recipientName: f.body.recipientName,
      });
      expect(JSON.stringify(result)).not.toMatch(
        /financialSnapshot|verificationNote|performedByUserId/,
      );
      expect(
        await f.operations.releaseCompletedVehicle(
          f.operator,
          f.booking.id,
          f.body,
          context(),
        ),
      ).toEqual(result);
      for (const change of [
        { idempotencyKey: randomUUID() },
        { recipientName: "A different person" },
      ])
        await expect(
          f.operations.releaseCompletedVehicle(
            f.operator,
            f.booking.id,
            { ...f.body, ...change },
            context(),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
      const saved = await prisma.serviceVehicleRelease.findUniqueOrThrow({
        where: { bookingId: f.booking.id },
      });
      expect(saved.financialSnapshot).toMatchObject({
        kind: "CLEARED_SERVICE_INVOICES_V1",
        invoices: [{ id: f.invoice.id, depositCreditKobo: "6000" }],
      });
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toEqual(before);
      expect(
        await prisma.serviceVehicleRelease.count({ where: { bookingId: f.booking.id } }),
      ).toBe(1);
      await expect(
        prisma.serviceVehicleRelease.update({
          where: { id: saved.id },
          data: { recipientName: "Rewrite" },
        }),
      ).rejects.toThrow(/immutable/);
      await expect(
        prisma.serviceVehicleRelease.delete({ where: { id: saved.id } }),
      ).rejects.toThrow(/immutable/);
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "BOOKING",
            entityId: f.booking.id,
            newValues: { path: ["releaseId"], equals: saved.id },
          },
        }),
      ).toBe(1);
    });
    it("refuses collection before completion or settlement without creating a release", async () => {
      const f = await fixture(),
        operations = new ServiceOperationsService(prisma);
      const body = {
        expectedBookingVersion: f.booking.version,
        financialReviewHash: "0".repeat(64),
        idempotencyKey: randomUUID(),
        recipientName: "Synthetic collector",
        verificationNote: "Synthetic identity and collection review",
        identityAndAuthorityVerified: true as const,
      };
      await expect(
        operations.releaseCompletedVehicle(f.operator, f.booking.id, body, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      const { work } = await agreedWork(f),
        materials = await f.create("MATERIALS");
      await f.capture(materials.id);
      await prisma.workOrder.update({
        where: { id: work.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await f.complete();
      const current = await prisma.booking.findUniqueOrThrow({
        where: { id: f.booking.id },
      });
      await expect(
        operations.releaseCompletedVehicle(
          f.operator,
          f.booking.id,
          { ...body, expectedBookingVersion: current.version },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      const pending = await f.create("WORKMANSHIP");
      await expect(
        operations.releaseCompletedVehicle(
          f.operator,
          f.booking.id,
          { ...body, expectedBookingVersion: current.version },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.serviceVehicleRelease.count({ where: { bookingId: f.booking.id } }),
      ).toBe(0);
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: pending.id } }),
      ).toMatchObject({ status: "REQUIRES_PAYMENT" });
    });
    it("refuses unverified/revoked actors, stale reviews and unsettled financial adjustments at collection", async () => {
      const f = await collectionFixture();
      await expect(
        f.operations.releaseCompletedVehicle(f.actor, f.booking.id, f.body, context()),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.operations.releaseCompletedVehicle(
          { ...f.operator, mfaVerifiedAt: null },
          f.booking.id,
          f.body,
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 403 });
      await expect(
        f.operations.releaseCompletedVehicle(
          f.operator,
          f.booking.id,
          { ...f.body, expectedBookingVersion: f.body.expectedBookingVersion + 1 },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await prisma.paymentAnomaly.create({
        data: {
          paymentId: f.labour.id,
          type: "DUPLICATE_SUCCESS",
          summary: "Synthetic collection hold",
        },
      });
      await expect(
        f.operations.releaseCompletedVehicle(f.operator, f.booking.id, f.body, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      await prisma.session.update({
        where: { id: f.operator.sessionId },
        data: { revokedAt: new Date() },
      });
      await expect(
        f.operations.releaseCompletedVehicle(f.operator, f.booking.id, f.body, context()),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(
        await prisma.serviceVehicleRelease.count({ where: { bookingId: f.booking.id } }),
      ).toBe(0);
    });
    it("serializes competing collection reviews and requires authenticated CSRF-protected administrator HTTP", async () => {
      const f = await collectionFixture(),
        headers = await testHeaders(f.operator),
        url = `/api/v1/staff/bookings/${f.booking.id}/vehicle-release`;
      const app = createApp();
      const worker = await prisma.user.create({
        data: {
          email: `${randomUUID()}@example.test`,
          passwordHash: "unusable-synthetic-only",
          role: "STAFF",
          emailVerifiedAt: new Date(),
          staffProfile: {
            create: {
              firstName: "Synthetic",
              lastName: "Read-only technician",
              branchId: f.booking.branchId!,
            },
          },
        },
      });
      const workerHeaders = await testHeaders({
        ...f.operator,
        userId: worker.id,
        email: worker.email,
        role: "STAFF",
      });
      await request(app)
        .get(`/api/v1/staff/bookings/${f.booking.id}`)
        .set(workerHeaders)
        .expect(200);
      await request(app)
        .get(`/api/v1/staff/bookings/${f.booking.id}/vehicle-release-readiness`)
        .set(workerHeaders)
        .expect(403);
      await request(app).post(url).set(workerHeaders).send(f.body).expect(403);
      await request(app)
        .post(url)
        .set(headers)
        .send({ ...f.body, financialReviewHash: undefined })
        .expect(422);

      const customerHeaders = await testHeaders(f.actor);
      await request(app).post(url).set(customerHeaders).send(f.body).expect(403);
      const noCsrf = { ...headers };
      delete noCsrf["x-csrf-token"];
      await request(app).post(url).set(noCsrf).send(f.body).expect(403);
      await request(app)
        .post(url)
        .set(headers)
        .send({ ...f.body, identityAndAuthorityVerified: false })
        .expect(422);
      const results = await Promise.all(
        [1, 2].map(() =>
          request(app)
            .post(url)
            .set(headers)
            .send({ ...f.body, idempotencyKey: randomUUID() }),
        ),
      );
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      const view = await request(app)
        .get(`/api/v1/customers/bookings/${f.booking.id}`)
        .set(customerHeaders)
        .expect(200);
      expect(view.body.data.vehicleRelease).toMatchObject({
        id: expect.any(String),
        releasedAt: expect.any(String),
      });
      expect(Object.keys(view.body.data.vehicleRelease).sort()).toEqual([
        "id",
        "releasedAt",
      ]);
    });
    it("keeps exactly one accepted original quotation before invoicing", async () => {
      const f = await fixture(),
        source = await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } });
      const booking = await prisma.booking.create({
        data: {
          customerId: source.customerId,
          branchId: source.branchId,
          serviceId: source.serviceId,
          scheduledAt: new Date(Date.now() + 3600000),
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });
      const operations = new ServiceOperationsService(prisma);
      const body = {
        items: [
          {
            type: "LABOUR" as const,
            description: "Original synthetic scope",
            quantity: 1,
            unitPriceKobo: "5000",
          },
        ],
        taxKobo: "0",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };
      const first = (await operations.createQuote(
        f.operator,
        booking.id,
        body,
        context(),
      )) as { id: string };
      await operations.issueQuote(
        f.operator,
        booking.id,
        first.id,
        { expectedRevision: 0 },
        context(),
      );
      await operations.acceptQuote(
        f.actor,
        booking.id,
        first.id,
        { expectedRevision: 1 },
        context(),
      );
      const second = (await operations.createQuote(
        f.operator,
        booking.id,
        body,
        context(),
      )) as { id: string };
      await operations.issueQuote(
        f.operator,
        booking.id,
        second.id,
        { expectedRevision: 0 },
        context(),
      );
      await expect(
        operations.acceptQuote(
          f.actor,
          booking.id,
          second.id,
          { expectedRevision: 1 },
          context(),
        ),
      ).rejects.toThrow();
      expect(
        await prisma.serviceQuote.count({
          where: { bookingId: booking.id, status: "ACCEPTED", originalInvoiceId: null },
        }),
      ).toBe(1);
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: second.id } }),
      ).toMatchObject({ status: "ISSUED" });
    });
    it("requires explicit additional-work intent and a current booking review after invoicing", async () => {
      const f = await fixture(),
        { operations, body } = await additionalQuote(f);
      const { additionalWork: _additional, ...base } = body;
      const before = await prisma.serviceQuote.count({
        where: { bookingId: f.booking.id },
      });
      await expect(
        operations.createQuote(f.operator, f.booking.id, base, context()),
      ).rejects.toThrow(/Choose Additional work/);
      await expect(
        operations.createQuote(
          f.operator,
          f.booking.id,
          {
            ...body,
            additionalWork: { ...body.additionalWork, expectedBookingVersion: 99 },
          },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await prisma.serviceQuote.count({ where: { bookingId: f.booking.id } }),
      ).toBe(before);
    });
    it("accepts itemised additional work without replacing the original quote, invoice or payments", async () => {
      const f = await fixture(),
        before = await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } });
      const { operations, quote } = await additionalQuote(f);
      expect(quote).toMatchObject({
        originalInvoice: { invoiceNumber: before.invoiceNumber },
        amendmentReason: expect.stringContaining("Synthetic"),
      });
      expect(quote).not.toHaveProperty("originalInvoiceId");
      const issued = (await operations.issueQuote(
        f.operator,
        f.booking.id,
        quote.id,
        { expectedRevision: 0 },
        context(),
      )) as { revision: number };
      for (const input of [
        { expectedRevision: issued.revision },
        {
          ...additionalConsent(quote),
          acceptedAdditionalWork: {
            ...additionalConsent(quote).acceptedAdditionalWork,
            invoiceNumber: "WRONG",
          },
        },
        {
          ...additionalConsent(quote),
          acceptedAdditionalWork: {
            ...additionalConsent(quote).acceptedAdditionalWork,
            quoteVersion: quote.version + 1,
          },
        },
        {
          ...additionalConsent(quote),
          acceptedAdditionalWork: {
            ...additionalConsent(quote).acceptedAdditionalWork,
            reason: "Unreviewed reason",
          },
        },
      ])
        await expect(
          operations.acceptQuote(f.actor, f.booking.id, quote.id, input, context()),
        ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.serviceQuote.update({
          where: { id: quote.id },
          data: { status: "ACCEPTED", acceptedAt: new Date() },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.booking.update({
          where: { id: f.booking.id },
          data: { quotedPriceKobo: 5375n },
        }),
      ).rejects.toThrow();
      await operations.acceptQuote(
        f.actor,
        f.booking.id,
        quote.id,
        additionalConsent(quote, issued.revision),
        context(),
      );
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toEqual(before);
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({ quotedPriceKobo: 20000n, version: 1 });
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: f.quote.id } }),
      ).toMatchObject({ status: "ACCEPTED", totalKobo: 21500n });
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: quote.id } }),
      ).toMatchObject({
        status: "ACCEPTED",
        totalKobo: 5375n,
        originalInvoiceId: f.invoice.id,
      });
      const accepted = await prisma.serviceQuote.findUniqueOrThrow({
        where: { id: quote.id },
      });
      expect(accepted.acceptedAdditionalContext).toEqual({
        kind: "ADDITIONAL_WORK",
        ...additionalConsent(quote).acceptedAdditionalWork,
        customerUserId: f.actor.userId,
      });
      await expect(
        prisma.serviceQuote.update({
          where: { id: quote.id },
          data: { acceptedAdditionalContext: { kind: "changed" } },
        }),
      ).rejects.toThrow();
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(0);
      expect(await f.input("MATERIALS")).toMatchObject({
        acceptedServiceStage: { amountKobo: "10750" },
      });
      const rebuilt = await prisma.$transaction((tx) => buildInvoiceSnapshot(tx, before));
      expect(rebuilt.servicePaymentPlan?.quoteId).toBe(f.quote.id);
      const { work } = await agreedWork(f);
      await expect(
        operations.updateWorkOrder(
          f.operator,
          f.booking.id,
          work.id,
          {
            expectedVersion: 0,
            addItems: [
              {
                type: "LABOUR",
                description: "Additional inspection",
                quantity: 1,
                unitPriceKobo: "5000",
              },
            ],
          },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("keeps rejected additional work separate and revises a draft with its saved parent context", async () => {
      const f = await fixture(),
        { operations, quote, body } = await additionalQuote(f);
      const { additionalWork: _additional, ...fields } = body;
      const revised = (await operations.replaceQuote(
        f.operator,
        f.booking.id,
        quote.id,
        {
          ...fields,
          expectedRevision: 0,
          amendmentReason: "Revised synthetic reason before issue",
        },
        context(),
      )) as { id: string; revision: number };
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: quote.id } }),
      ).toMatchObject({ status: "VOID", amendmentReason: body.additionalWork.reason });
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: revised.id } }),
      ).toMatchObject({
        originalInvoiceId: f.invoice.id,
        amendmentReason: "Revised synthetic reason before issue",
      });
      const issued = (await operations.issueQuote(
        f.operator,
        f.booking.id,
        revised.id,
        { expectedRevision: revised.revision },
        context(),
      )) as { revision: number };
      await operations.rejectQuote(
        f.actor,
        f.booking.id,
        revised.id,
        { expectedRevision: issued.revision },
        context(),
      );
      expect(
        await prisma.booking.findUniqueOrThrow({ where: { id: f.booking.id } }),
      ).toMatchObject({ quotedPriceKobo: 20000n, version: 0 });
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: revised.id } }),
      ).toMatchObject({ status: "REJECTED" });
      expect(await prisma.invoice.count({ where: { bookingId: f.booking.id } })).toBe(1);
    });
    it("supersedes only pending additions and never voids an accepted agreement", async () => {
      const f = await fixture(),
        first = await additionalQuote(f);
      await first.operations.issueQuote(
        f.operator,
        f.booking.id,
        first.quote.id,
        { expectedRevision: 0 },
        context(),
      );
      const second = await additionalQuote(
        f,
        "Replacement pending addition, not a replacement original invoice",
      );
      await second.operations.issueQuote(
        f.operator,
        f.booking.id,
        second.quote.id,
        { expectedRevision: 0 },
        context(),
      );
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: first.quote.id } }),
      ).toMatchObject({ status: "VOID" });
      await second.operations.acceptQuote(
        f.actor,
        f.booking.id,
        second.quote.id,
        additionalConsent(second.quote),
        context(),
      );
      const third = await additionalQuote(
        f,
        "Another separately reviewed additional item",
      );
      await third.operations.issueQuote(
        f.operator,
        f.booking.id,
        third.quote.id,
        { expectedRevision: 0 },
        context(),
      );
      for (const id of [f.quote.id, second.quote.id])
        expect(
          await prisma.serviceQuote.findUniqueOrThrow({ where: { id } }),
        ).toMatchObject({ status: "ACCEPTED" });
    });
    it("enforces original-invoice binding, frozen reasons and original amount snapshots in PostgreSQL", async () => {
      const f = await fixture(),
        foreign = await fixture(),
        { quote } = await additionalQuote(f);
      await expect(
        prisma.serviceQuote.update({
          where: { id: quote.id },
          data: { originalInvoiceId: foreign.invoice.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.serviceQuote.update({
          where: { id: quote.id },
          data: { amendmentReason: "Silently changed saved scope" },
        }),
      ).rejects.toThrow();
      const original = await prisma.serviceQuote.findUniqueOrThrow({
        where: { id: f.quote.id },
      });
      await expect(
        prisma.serviceQuote.create({
          data: {
            bookingId: foreign.booking.id,
            createdByStaffId: original.createdByStaffId,
            quoteNumber: randomUUID(),
            version: 99,
            subtotalKobo: 0n,
            totalKobo: 0n,
            originalInvoiceId: f.invoice.id,
            amendmentReason: "Synthetic cross-booking binding must fail",
          },
        }),
      ).rejects.toThrow();
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ totalKobo: 21500n, status: "ISSUED" });
    });
    it("does not let another customer accept the additional work", async () => {
      const f = await fixture(),
        other = await fixture(),
        { operations, quote } = await additionalQuote(f);
      await operations.issueQuote(
        f.operator,
        f.booking.id,
        quote.id,
        { expectedRevision: 0 },
        context(),
      );
      await expect(
        operations.acceptQuote(
          other.actor,
          f.booking.id,
          quote.id,
          { expectedRevision: 1 },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      expect(
        await prisma.serviceQuote.findUniqueOrThrow({ where: { id: quote.id } }),
      ).toMatchObject({ status: "ISSUED" });
    });
    it("runs authoring, CSRF, customer review, acceptance and reload through authenticated HTTP without a charge", async () => {
      const f = await fixture();
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const staff = await testHeaders(f.operator),
        customer = await testHeaders(f.actor);
      const body = {
        items: [
          {
            type: "LABOUR",
            description: "Synthetic extra inspection",
            quantity: 1,
            unitPriceKobo: "5000",
          },
        ],
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        additionalWork: {
          expectedBookingVersion: 0,
          reason: "Synthetic customer-visible additional scope",
        },
      };
      const base = `/api/v1/staff/bookings/${f.booking.id}/quotes`;
      const { "x-csrf-token": _csrf, ...withoutCsrf } = staff;
      await request(app).post(base).set(withoutCsrf).send(body).expect(403);
      const saved = await request(app).post(base).set(staff).send(body).expect(201);
      const id = saved.body.data.id as string;
      const issued = await request(app)
        .post(`${base}/${id}/issue`)
        .set(staff)
        .send({ expectedRevision: 0 })
        .expect(200);
      expect(
        Date.parse(issued.body.data.expiresAt) - Date.parse(issued.body.data.issuedAt),
      ).toBe(7 * 86400000);
      const read = await request(app)
        .get(`/api/v1/customers/bookings/${f.booking.id}`)
        .set(customer)
        .expect(200);
      const shown = read.body.data.quotes.find((row: { id: string }) => row.id === id);
      expect(shown).toMatchObject({
        originalInvoice: { invoiceNumber: f.invoice.invoiceNumber },
        amendmentReason: body.additionalWork.reason,
        totalKobo: "5375",
      });
      expect(shown).not.toHaveProperty("originalInvoiceId");
      expect(shown).not.toHaveProperty("acceptedAdditionalContext");
      const accept = `/api/v1/customers/bookings/${f.booking.id}/quotes/${id}/accept`;
      await request(app)
        .post(accept)
        .set(customer)
        .send(additionalConsent(shown))
        .expect(200);
      const refreshed = await request(app)
        .get(`/api/v1/customers/bookings/${f.booking.id}`)
        .set(customer)
        .expect(200);
      expect(
        refreshed.body.data.quotes.find((row: { id: string }) => row.id === id).status,
      ).toBe("ACCEPTED");
      expect(
        refreshed.body.data.quotes.find((row: { id: string }) => row.id === id),
      ).not.toHaveProperty("acceptedAdditionalContext");
      await request(app)
        .post(accept)
        .set(customer)
        .send(additionalConsent(shown))
        .expect(409);
      expect(await prisma.payment.count({ where: { invoiceId: f.invoice.id } })).toBe(0);
      expect(await prisma.invoice.count({ where: { bookingId: f.booking.id } })).toBe(1);
    });
    it("bills an accepted addition once, gates its own materials, and settles workmanship only after completion", async () => {
      const f = await fixture(true),
        { operations, quote } = await additionalQuote(
          f,
          "Agreed additional material and inspection",
          true,
        );
      const originalBefore = await prisma.invoice.findUniqueOrThrow({
        where: { id: f.invoice.id },
      });
      expect(originalBefore.depositCreditKobo).toBe(6000n);
      await operations.issueQuote(
        f.operator,
        f.booking.id,
        quote.id,
        { expectedRevision: 0 },
        context(),
      );
      await operations.acceptQuote(
        f.actor,
        f.booking.id,
        quote.id,
        additionalConsent(quote),
        context(),
      );
      const app = createApp({ checkReadiness: async () => undefined, rateLimit: 10000 });
      const staffHeaders = await testHeaders(f.operator),
        customerHeaders = await testHeaders(f.actor);
      const source = { sourceType: "SERVICE_ADDITION", sourceId: quote.id };
      await request(app)
        .post("/api/v1/staff/invoices")
        .set(staffHeaders)
        .send({ ...source, depositCreditKobo: "3000" })
        .expect(422);
      await request(app)
        .post("/api/v1/staff/invoices")
        .set(staffHeaders)
        .send(source)
        .expect(201);
      let extra = await prisma.invoice.findUniqueOrThrow({
        where: { additionalQuoteId: quote.id },
      });
      expect(extra).toMatchObject({
        bookingId: null,
        subtotalKobo: 15000n,
        taxKobo: 1125n,
        totalKobo: 16125n,
        depositCreditKobo: 0n,
      });
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toEqual(originalBefore);
      await f.billing.issue(f.operator, extra.id, { expectedVersion: 0 }, context());
      const { work } = await agreedWork(f);
      const originalMaterial = await f.create("MATERIALS");
      await f.capture(originalMaterial.id);
      await prisma.workOrder.update({
        where: { id: work.id },
        data: { startedAt: new Date(), status: "IN_PROGRESS" },
      });
      const addItems = [
        { type: "PART" as const, productId: f.product.id, quantity: 1 },
        {
          type: "LABOUR" as const,
          description: "Additional inspection",
          quantity: 1,
          unitPriceKobo: "5000",
        },
      ];
      await expect(
        operations.updateWorkOrder(
          f.operator,
          f.booking.id,
          work.id,
          { expectedVersion: 0, addItems },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      async function intent(stage: "MATERIALS" | "WORKMANSHIP") {
        extra = await prisma.invoice.findUniqueOrThrow({ where: { id: extra.id } });
        const plan = servicePaymentPlanFromSnapshot(extra.documentSnapshot, extra)!;
        return {
          targetType: "INVOICE" as const,
          targetId: extra.id,
          purpose: "SERVICE_INVOICE" as const,
          acceptedServiceStage: {
            stage,
            invoiceVersion: extra.version,
            amountKobo:
              stage === "MATERIALS"
                ? plan.materials.totalKobo
                : plan.workmanship.totalKobo,
          },
        };
      }
      await expect(
        f.payments.createIntent(
          f.actor,
          await intent("WORKMANSHIP"),
          randomUUID(),
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await f.payments.createIntent(
        f.actor,
        await intent("MATERIALS"),
        randomUUID(),
        context(),
      );
      const material = await prisma.payment.findFirstOrThrow({
        where: { invoiceId: extra.id },
      });
      expect(material.amountKobo).toBe(10750n);
      const scoped = await prisma.payment.findFirst({
        where: { id: material.id, ...financeScope([f.booking.branchId!]) },
        select: workforceFinanceSelect,
      });
      expect(scoped).not.toBeNull();
      expect(projectWorkforcePayment(scoped!, [f.booking.branchId!]).sources).toEqual([
        expect.objectContaining({ kind: "INVOICE", reference: extra.invoiceNumber }),
      ]);
      expect(
        await prisma.payment.count({
          where: { id: material.id, ...financeScope([randomUUID()]) },
        }),
      ).toBe(0);
      await expect(
        operations.updateWorkOrder(
          f.operator,
          f.booking.id,
          work.id,
          { expectedVersion: 0, addItems },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
      await f.capture(material.id);
      await operations.updateWorkOrder(
        f.operator,
        f.booking.id,
        work.id,
        { expectedVersion: 0, addItems },
        context(),
      );
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${f.booking.id}::uuid FOR UPDATE`;
        await assertAgreedWorkCanProceed(tx, f.booking.id, true);
      });
      const documents = new FinancialDocumentsService(prisma);
      const paper = await documents.invoice(f.actor, extra.id);
      expect(paper).toMatchObject({
        source: {
          type: "SERVICE_ADDITION",
          id: quote.id,
          originalInvoiceNumber: f.invoice.invoiceNumber,
          amendmentReason: "Agreed additional material and inspection",
        },
        subtotalKobo: "15000",
        depositCreditKobo: "0",
      });
      const read = await request(app)
        .get(`/api/v1/customers/invoices/${extra.id}`)
        .set(customerHeaders)
        .expect(200);
      const publicInvoice = read.body.data;
      const pdf = await renderFinancialPdf(paper);
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(1000);
      expect(publicInvoice).toMatchObject({
        additionalQuote: { id: quote.id },
        servicePayment: {
          materials: { recordedKobo: "10750" },
          workCompleted: false,
          nextPayment: null,
        },
      });
      expect(JSON.stringify(publicInvoice)).not.toContain("acceptedAdditionalContext");
      expect(JSON.stringify(publicInvoice)).not.toContain("customerUserId");
      expect(publicInvoice.additionalQuote.originalInvoice).toEqual({
        invoiceNumber: f.invoice.invoiceNumber,
      });
      await f.complete();
      await prisma.workOrder.update({
        where: { id: work.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      await f.payments.createIntent(
        f.actor,
        await intent("WORKMANSHIP"),
        randomUUID(),
        context(),
      );
      const labour = await prisma.payment.findFirstOrThrow({
        where: { invoiceId: extra.id, status: "REQUIRES_PAYMENT" },
      });
      expect(labour.amountKobo).toBe(5375n);
      await f.capture(labour.id);
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: extra.id } }),
      ).toMatchObject({ status: "PAID", totalKobo: 16125n });
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({
        totalKobo: originalBefore.totalKobo,
        documentSnapshot: originalBefore.documentSnapshot,
        status: "ISSUED",
      });
      await expect(
        operations.reviewVehicleRelease(f.operator, f.booking.id),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringMatching(/workmanship/),
      });
      const baseLabour = await f.create("WORKMANSHIP");
      await f.capture(baseLabour.id);
      const clearance = await operations.reviewVehicleRelease(f.operator, f.booking.id);
      await operations.releaseCompletedVehicle(
        f.operator,
        f.booking.id,
        {
          expectedBookingVersion: clearance.bookingVersion,
          financialReviewHash: clearance.financialReviewHash,
          idempotencyKey: randomUUID(),
          recipientName: "Synthetic additional-work collector",
          verificationNote: "Synthetic identity and authority checked in person",
          identityAndAuthorityVerified: true,
        },
        context(),
      );
      const handover = await prisma.serviceVehicleRelease.findUniqueOrThrow({
        where: { bookingId: f.booking.id },
      });
      expect(handover.financialSnapshot).toMatchObject({
        invoices: [
          { id: f.invoice.id, depositCreditKobo: "6000" },
          { id: extra.id, depositCreditKobo: "0" },
        ],
      });

      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: f.invoice.id } }),
      ).toMatchObject({ status: "PAID", totalKobo: originalBefore.totalKobo });
      expect(
        await prisma.payment.aggregate({
          where: { invoiceId: { in: [extra.id, f.invoice.id] }, status: "SUCCEEDED" },
          _sum: { amountKobo: true },
        }),
      ).toMatchObject({ _sum: { amountKobo: 31625n } });
      await expect(
        f.billing.create(
          f.operator,
          { sourceType: "SERVICE_ADDITION", sourceId: quote.id },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
    it("refuses unaccepted/foreign sources, concurrent duplicate invoices and source/credit rewrites", async () => {
      const f = await fixture(),
        { operations, quote } = await additionalQuote(
          f,
          "Separate material requiring review",
          true,
        );
      await expect(
        f.billing.create(
          f.operator,
          { sourceType: "SERVICE_ADDITION", sourceId: f.quote.id },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      await expect(
        f.billing.create(
          f.operator,
          { sourceType: "SERVICE_ADDITION", sourceId: quote.id },
          context(),
        ),
      ).rejects.toMatchObject({ statusCode: 404 });
      await operations.issueQuote(
        f.operator,
        f.booking.id,
        quote.id,
        { expectedRevision: 0 },
        context(),
      );
      await operations.acceptQuote(
        f.actor,
        f.booking.id,
        quote.id,
        additionalConsent(quote),
        context(),
      );
      const result = await Promise.allSettled(
        [1, 2].map(() =>
          f.billing.create(
            f.operator,
            { sourceType: "SERVICE_ADDITION", sourceId: quote.id },
            context(),
          ),
        ),
      );
      expect(result.filter((row) => row.status === "fulfilled")).toHaveLength(1);
      expect(result.filter((row) => row.status === "rejected")).toHaveLength(1);
      const extra = await prisma.invoice.findUniqueOrThrow({
        where: { additionalQuoteId: quote.id },
      });
      await expect(
        prisma.invoice.update({
          where: { id: extra.id },
          data: { additionalQuoteId: f.quote.id },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.invoice.update({
          where: { id: extra.id },
          data: { depositCreditKobo: 1n, totalKobo: extra.totalKobo - 1n },
        }),
      ).rejects.toThrow();
      await f.billing.issue(f.operator, extra.id, { expectedVersion: 0 }, context());
      expect(await f.billing.customerGet(f.actor, extra.id)).toMatchObject({
        servicePayment: { nextPayment: { stage: "MATERIALS" } },
      });
      const foreign = await fixture();
      await expect(f.billing.customerGet(foreign.actor, extra.id)).rejects.toMatchObject({
        statusCode: 404,
      });
      await expect(
        prisma.invoice.update({
          where: { id: extra.id },
          data: { customerId: foreign.booking.customerId },
        }),
      ).rejects.toThrow();
      await f.billing.void(f.operator, f.invoice.id, { expectedVersion: 1 }, context());
      expect(await f.billing.customerGet(f.actor, extra.id)).toMatchObject({
        servicePayment: { financialReviewRequired: true, nextPayment: null },
      });
      await expect(
        f.billing.issue(f.operator, extra.id, { expectedVersion: 0 }, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.invoice.update({
          where: { id: extra.id },
          data: { status: "ISSUED", issuedAt: new Date() },
        }),
      ).rejects.toThrow();
    });
    it("keeps a supplemental late capture as real money for review when the original agreement was voided", async () => {
      const f = await fixture(),
        { operations, quote } = await additionalQuote(
          f,
          "Additional materials only",
          true,
        );
      await operations.issueQuote(
        f.operator,
        f.booking.id,
        quote.id,
        { expectedRevision: 0 },
        context(),
      );
      await operations.acceptQuote(
        f.actor,
        f.booking.id,
        quote.id,
        additionalConsent(quote),
        context(),
      );
      await f.billing.create(
        f.operator,
        { sourceType: "SERVICE_ADDITION", sourceId: quote.id },
        context(),
      );
      const invoice = await prisma.invoice.findUniqueOrThrow({
        where: { additionalQuoteId: quote.id },
      });
      await f.billing.issue(f.operator, invoice.id, { expectedVersion: 0 }, context());
      await f.payments.createIntent(
        f.actor,
        {
          targetType: "INVOICE",
          targetId: invoice.id,
          purpose: "SERVICE_INVOICE",
          acceptedServiceStage: {
            stage: "MATERIALS",
            invoiceVersion: 1,
            amountKobo: "10750",
          },
        },
        randomUUID(),
        context(),
      );
      const payment = await prisma.payment.findFirstOrThrow({
        where: { invoiceId: invoice.id },
      });
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
        await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }),
      ).toMatchObject({ status: "ISSUED" });
    });
    it.each(["BOOKING", "WORK_ORDER"])(
      "refuses late additional acceptance after %s completion without fabricating new completion",
      async (kind) => {
        const f = await fixture(),
          { operations, quote } = await additionalQuote(f);
        await operations.issueQuote(
          f.operator,
          f.booking.id,
          quote.id,
          { expectedRevision: 0 },
          context(),
        );
        if (kind === "BOOKING") await f.complete();
        else {
          const { work } = await agreedWork(f, false);
          await prisma.workOrder.update({
            where: { id: work.id },
            data: {
              status: "COMPLETED",
              startedAt: new Date(Date.now() - 1000),
              completedAt: new Date(),
            },
          });
        }
        await expect(
          operations.acceptQuote(
            f.actor,
            f.booking.id,
            quote.id,
            additionalConsent(quote),
            context(),
          ),
        ).rejects.toMatchObject({ statusCode: 409 });
        await expect(
          prisma.serviceQuote.update({
            where: { id: quote.id },
            data: {
              status: "ACCEPTED",
              acceptedAt: new Date(),
              acceptedAdditionalContext: {
                kind: "ADDITIONAL_WORK",
                ...additionalConsent(quote).acceptedAdditionalWork,
                customerUserId: f.actor.userId,
              },
            },
          }),
        ).rejects.toThrow();
        expect(
          await prisma.invoice.count({ where: { additionalQuoteId: quote.id } }),
        ).toBe(0);
        await operations.rejectQuote(
          f.actor,
          f.booking.id,
          quote.id,
          { expectedRevision: 1 },
          context(),
        );
        expect(
          await prisma.serviceQuote.findUniqueOrThrow({ where: { id: quote.id } }),
        ).toMatchObject({ status: "REJECTED" });
      },
    );
    it("refuses preparing or issuing an unreviewed supplement after an old completion while preserving the draft", async () => {
      const f = await fixture(),
        { operations, quote } = await additionalQuote(f);
      await operations.issueQuote(
        f.operator,
        f.booking.id,
        quote.id,
        { expectedRevision: 0 },
        context(),
      );
      await operations.acceptQuote(
        f.actor,
        f.booking.id,
        quote.id,
        additionalConsent(quote),
        context(),
      );
      await f.billing.create(
        f.operator,
        { sourceType: "SERVICE_ADDITION", sourceId: quote.id },
        context(),
      );
      const draft = await prisma.invoice.findUniqueOrThrow({
        where: { additionalQuoteId: quote.id },
      });
      await f.complete();
      await expect(
        f.billing.issue(f.operator, draft.id, { expectedVersion: 0 }, context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      await expect(
        prisma.invoice.update({
          where: { id: draft.id },
          data: { status: "ISSUED", issuedAt: new Date() },
        }),
      ).rejects.toThrow();
      expect(
        await prisma.invoice.findUniqueOrThrow({ where: { id: draft.id } }),
      ).toMatchObject({ status: "DRAFT", version: 0 });
      expect(await prisma.payment.count({ where: { invoiceId: draft.id } })).toBe(0);
    });
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
