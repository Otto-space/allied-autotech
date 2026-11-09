import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { BillingService } from "../../src/modules/billing/billing.service.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { servicePaymentPlanFromSnapshot } from "../../src/modules/billing/service-payment-plan.js";
import { paymentTestSession } from "../helpers/payment-session.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
async function fixture() {
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
  async function input(stage: "MATERIALS" | "WORKMANSHIP", amountKobo = "10750") {
    const current = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    return {
      targetType: "INVOICE" as const,
      targetId: invoice.id,
      purpose: "SERVICE_INVOICE" as const,
      acceptedServiceStage: { stage, invoiceVersion: current.version, amountKobo },
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

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "synthetic D03 service payment stages on an isolated database",
  () => {
    beforeAll(assertIsolatedLoopbackDatabase);
    afterAll(() => prisma.$disconnect());
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
  },
);
