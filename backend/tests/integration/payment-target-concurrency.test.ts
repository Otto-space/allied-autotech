import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { BillingService } from "../../src/modules/billing/billing.service.js";
import { BillingRepository } from "../../src/modules/billing/billing.repository.js";
import type { PaymentCreateInput } from "../../src/modules/payments/payments.schemas.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { VehicleSalesService } from "../../src/modules/vehicle-sales/vehicle-sales.service.js";
import { VehicleSalesRepository } from "../../src/modules/vehicle-sales/vehicle-sales.repository.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type { PaymentProviderPort } from "../../src/providers/payments/payment-provider.port.js";
import { paymentTestSession } from "../helpers/payment-session.js";

const context = () => ({ requestId: randomUUID(), ipAddress: null, userAgent: null });
const manual = () => ({
  method: "BANK_TRANSFER" as const,
  payerName: "Isolated Target",
  transferredAt: new Date().toISOString(),
});
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
async function administrator(): Promise<AuthenticatedActor> {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      role: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  return {
    userId: user.id,
    email: user.email,
    role: "ADMIN",
    sessionId: await paymentTestSession(user.id, "ADMIN"),
    mfaRequired: true,
    mfaVerifiedAt: new Date(),
  };
}
async function expectSourceWait(kind: "INVOICE" | "VEHICLE_TRANSACTION") {
  await expect
    .poll(
      async () => {
        const rows = await prisma.$queryRaw<{ blocked: boolean }[]>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
          AND cardinality(pg_blocking_pids(pid)) > 0
          AND query LIKE '%FOR UPDATE%'
          AND query LIKE ${`%"${kind === "INVOICE" ? "Invoice" : "VehicleTransaction"}"%`}
        ) AS blocked`;
        return rows[0]?.blocked;
      },
      { timeout: 3000, interval: 20 },
    )
    .toBe(true);
}
async function fixture(kind: PaymentCreateInput["targetType"] = "ORDER") {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      emailVerifiedAt: new Date(),
      profile: {
        create: { firstName: "Isolated", lastName: "Target", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const actor: AuthenticatedActor = {
    userId: user.id,
    email: user.email,
    role: "CUSTOMER",
    sessionId: await paymentTestSession(user.id),
    mfaRequired: false,
    mfaVerifiedAt: null,
  };
  const customerId = user.profile!.id;
  const branch = await prisma.branch.create({
    data: {
      code: `TC-${randomUUID().slice(0, 8)}`,
      name: "Synthetic target",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const details = {
    customerId,
    customerName: "Isolated Target",
    customerEmail: user.email,
    customerPhone: "+2348000000000",
  };
  const expiresAt = new Date(Date.now() + 3600000);
  let input: PaymentCreateInput;
  if (kind === "ORDER") {
    const order = await prisma.order.create({
      data: {
        ...details,
        branchId: branch.id,
        orderNumber: `TC-${randomUUID()}`,
        subtotalKobo: 10000n,
        totalKobo: 10000n,
        paymentDueAt: expiresAt,
      },
    });
    input = { targetType: kind, targetId: order.id, purpose: "ORDER_PAYMENT" };
  } else if (kind === "INVOICE") {
    const service = await prisma.service.create({
      data: {
        name: "Synthetic target",
        slug: randomUUID(),
        pricingType: "FIXED",
        priceKobo: 10000n,
        durationMinutes: 60,
      },
    });
    const booking = await prisma.booking.create({
      data: {
        customerId,
        branchId: branch.id,
        serviceId: service.id,
        scheduledAt: expiresAt,
        quotedPriceKobo: 10000n,
      },
    });
    const staff = await prisma.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        passwordHash: "unusable-synthetic-only",
        role: "STAFF",
        emailVerifiedAt: new Date(),
        staffProfile: {
          create: { firstName: "Synthetic", lastName: "Quote", branchId: branch.id },
        },
      },
      include: { staffProfile: true },
    });
    await prisma.serviceQuote.create({
      data: {
        bookingId: booking.id,
        createdByStaffId: staff.staffProfile!.id,
        quoteNumber: `TC-${randomUUID().slice(0, 20)}`,
        status: "ACCEPTED",
        subtotalKobo: 10000n,
        totalKobo: 10000n,
        issuedAt: new Date(),
        acceptedAt: new Date(),
        expiresAt,
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        customerId,
        bookingId: booking.id,
        invoiceNumber: `TC-${randomUUID()}`,
        subtotalKobo: 10000n,
        totalKobo: 10000n,
        status: "ISSUED",
        issuedAt: new Date(),
        dueAt: expiresAt,
      },
    });
    input = { targetType: kind, targetId: invoice.id, purpose: "SERVICE_INVOICE" };
  } else {
    const vehicle = await prisma.vehicle.create({
      data: {
        branchId: branch.id,
        stockNumber: `TC-${randomUUID()}`,
        make: "Test",
        model: "Target",
        year: 2025,
      },
    });
    const listing = await prisma.vehicleListing.create({
      data: {
        vehicleId: vehicle.id,
        branchId: branch.id,
        title: "Synthetic target",
        slug: randomUUID(),
        priceKobo: 10000n,
        status: "RESERVED",
        publishedAt: new Date(),
        reservedAt: new Date(),
      },
    });
    const sale = await prisma.vehicleTransaction.create({
      data: {
        ...details,
        vehicleListingId: listing.id,
        transactionNumber: `TC-${randomUUID()}`,
        askingPriceKobo: 10000n,
        agreedPriceKobo: 10000n,
        reservationRequiredKobo: 2500n,
        status: "PAYMENT_PENDING",
        ...(await testReservationAcceptance(customerId)),
        reservationExpiresAt: expiresAt,
      },
    });
    input = { targetType: kind, targetId: sale.id, purpose: "VEHICLE_FULL_PAYMENT" };
  }
  const initialize = vi.fn<PaymentProviderPort["initialize"]>(async (command) => ({
    authorizationUrl: `https://checkout.paystack.com/${command.reference}`,
    accessCode: "synthetic",
    providerReference: command.reference,
    authorizationExpiresAt: expiresAt,
  }));
  const provider: PaymentProviderPort = {
    initialize,
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
    async refund(): Promise<never> {
      throw new Error("Unexpected refund");
    },
  };
  const service = new PaymentsService(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: provider, MONNIFY: provider }),
  );
  const create = (key = randomUUID(), body = input) =>
    service.createIntent(actor, body, key, context());
  const payments = () => prisma.payment.findMany({ where: { customerId } });
  const legacy = () =>
    prisma.payment.create({
      data: {
        customerId,
        paymentNumber: `TC-${randomUUID()}`,
        idempotencyKeyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        purpose: input.purpose,
        amountKobo: 10000n,
        expiresAt,
        ...(kind === "ORDER"
          ? { orderId: input.targetId }
          : kind === "INVOICE"
            ? { invoiceId: input.targetId }
            : { vehicleTransactionId: input.targetId }),
      },
    });
  return { actor, input, service, create, payments, legacy, initialize };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "payment targets across distinct intents",
  () => {
    let restorePolicy: (() => Promise<unknown>) | undefined;
    beforeAll(async () => {
      const latest = await prisma.businessPolicyVersion.aggregate({
        where: { key: "vehicle" },
        _max: { version: true },
      });
      const original = await prisma.businessPolicyVersion.findFirstOrThrow({
        where: {
          key: "vehicle",
          source: { not: "Disposable target-concurrency test only" },
        },
        orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
      });
      const policy = await prisma.businessPolicyVersion.create({
        data: {
          key: "vehicle",
          version: (latest._max.version ?? 0) + 1,
          approvalStatus: "APPROVED",
          source: "Disposable target-concurrency test only",
          sourceQuestion: "Synthetic fixture",
          effectiveAt: new Date(),
          settings: {},
        },
      });
      restorePolicy = () =>
        prisma.businessPolicyVersion.create({
          data: {
            key: "vehicle",
            version: policy.version + 1,
            approvalStatus: original.approvalStatus,
            source: original.source,
            sourceQuestion: original.sourceQuestion,
            effectiveAt: new Date(),
            settings: original.settings ?? {},
            approvedByUserId: original.approvedByUserId,
          },
        });
    });
    afterAll(async () => {
      if (restorePolicy) await restorePolicy();
      await prisma.$disconnect();
    });
    for (const kind of ["ORDER", "INVOICE", "VEHICLE_TRANSACTION"] as const)
      it(`creates one ${kind} intent for competing keys, preserving original-key replay`, async () => {
        const f = await fixture(kind);
        const keys = [randomUUID(), randomUUID()];
        const outcomes = await Promise.allSettled(keys.map((key) => f.create(key)));
        expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(outcomes.find((r) => r.status === "rejected")).toMatchObject({
          reason: { statusCode: 409, code: "PAYMENT_TARGET_PENDING" },
        });
        const winner = outcomes.findIndex((r) => r.status === "fulfilled");
        expect(await f.create(keys[winner]!)).toMatchObject({ replayed: true });
        expect(await f.payments()).toHaveLength(1);
      });
    for (const kind of ["INVOICE", "VEHICLE_TRANSACTION"] as const)
      for (const operation of ["intent", "online", "manual"] as const)
        it(`${operation} rejects a ${kind} source transition committed while its row is locked`, async () => {
          const f = await fixture(kind);
          const existing = operation === "intent" ? null : (await f.create()).payment.id;
          const held = gate();
          const resume = gate();
          const transition = prisma
            .$transaction(async (tx) => {
              try {
                if (kind === "INVOICE") {
                  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${f.input.targetId}::uuid FOR UPDATE`;
                  await tx.invoice.update({
                    where: { id: f.input.targetId },
                    data: {
                      status: "VOID",
                      voidedAt: new Date(),
                      version: { increment: 1 },
                    },
                  });
                } else {
                  await tx.$queryRaw`SELECT "id" FROM "VehicleTransaction" WHERE "id" = ${f.input.targetId}::uuid FOR UPDATE`;
                  await tx.vehicleTransaction.update({
                    where: { id: f.input.targetId },
                    data: {
                      status: "CANCELLED",
                      cancelledAt: new Date(),
                      cancellationReason: "SYNTHETIC_SOURCE_TRANSITION",
                      version: { increment: 1 },
                    },
                  });
                }
                held.release();
                await resume.promise;
              } finally {
                held.release();
              }
            })
            .then(
              () => null,
              (error: unknown) => error,
            );
          await held.promise;
          const changing = (
            operation === "intent"
              ? f.create()
              : operation === "online"
                ? f.service.initializePaystack(
                    f.actor,
                    existing!,
                    randomUUID(),
                    context(),
                  )
                : f.service.submitManual(
                    f.actor,
                    existing!,
                    manual(),
                    randomUUID(),
                    context(),
                  )
          ).then(
            (result) => ({ result }),
            (error: unknown) => ({ error }),
          );
          let pollError: unknown = null;
          try {
            await expectSourceWait(kind);
          } catch (error) {
            pollError = error;
          } finally {
            resume.release();
          }
          const transitionError = await transition;
          if (transitionError) throw transitionError;
          if (pollError) throw pollError;
          expect(await changing).toMatchObject({ error: { statusCode: 404 } });
          expect(await f.payments()).toHaveLength(operation === "intent" ? 0 : 1);
          expect(
            await prisma.paymentAttempt.count({
              where: {
                payment:
                  kind === "INVOICE"
                    ? { invoiceId: f.input.targetId }
                    : { vehicleTransactionId: f.input.targetId },
              },
            }),
          ).toBe(0);
          expect(f.initialize).not.toHaveBeenCalled();
        });
    for (const kind of ["INVOICE", "VEHICLE_TRANSACTION"] as const)
      for (const operation of ["intent", "online", "manual"] as const)
        it(`serializes actual ${kind} operator cancellation before ${operation} payment entry`, async () => {
          const f = await fixture(kind);
          const existing = operation === "intent" ? null : (await f.create()).payment.id;
          const actor = await administrator();
          const held = gate();
          const resume = gate();
          const operator =
            kind === "INVOICE"
              ? (() => {
                  const original = BillingRepository.prototype.transition;
                  const spy = vi
                    .spyOn(BillingRepository.prototype, "transition")
                    .mockImplementationOnce(async function (
                      this: BillingRepository,
                      ...args
                    ) {
                      held.release();
                      await resume.promise;
                      return original.apply(this, args);
                    });
                  return {
                    promise: new BillingService(prisma).void(
                      actor,
                      f.input.targetId,
                      { expectedVersion: 0 },
                      context(),
                    ),
                    restore: () => spy.mockRestore(),
                  };
                })()
              : (() => {
                  const original = VehicleSalesRepository.prototype.updateTransaction;
                  const spy = vi
                    .spyOn(VehicleSalesRepository.prototype, "updateTransaction")
                    .mockImplementationOnce(async function (
                      this: VehicleSalesRepository,
                      ...args
                    ) {
                      held.release();
                      await resume.promise;
                      return original.apply(this, args);
                    });
                  return {
                    promise: new VehicleSalesService(prisma).transition(
                      actor,
                      f.input.targetId,
                      {
                        expectedVersion: 0,
                        status: "CANCELLED",
                        reason: "Synthetic test",
                      },
                      context(),
                    ),
                    restore: () => spy.mockRestore(),
                  };
                })();
          const operatorOutcome = operator.promise.then(
            (result) => ({ result }),
            (error: unknown) => ({ error }),
          );
          try {
            await Promise.race([
              held.promise,
              operatorOutcome.then(({ error }) => {
                if (error) throw error;
                throw new Error("Operator completed before the source lock checkpoint");
              }),
            ]);
            const changing = (
              operation === "intent"
                ? f.create()
                : operation === "online"
                  ? f.service.initializePaystack(
                      f.actor,
                      existing!,
                      randomUUID(),
                      context(),
                    )
                  : f.service.submitManual(
                      f.actor,
                      existing!,
                      manual(),
                      randomUUID(),
                      context(),
                    )
            ).then(
              (result) => ({ result }),
              (error: unknown) => ({ error }),
            );
            try {
              await expectSourceWait(kind);
            } finally {
              resume.release();
            }
            expect(await operatorOutcome).not.toHaveProperty("error");
            expect(await changing).toMatchObject({ error: { statusCode: 404 } });
            expect(await f.payments()).toHaveLength(operation === "intent" ? 0 : 1);
            expect(
              await prisma.paymentAttempt.count({
                where: {
                  payment:
                    kind === "INVOICE"
                      ? { invoiceId: f.input.targetId }
                      : { vehicleTransactionId: f.input.targetId },
                },
              }),
            ).toBe(0);
            expect(f.initialize).not.toHaveBeenCalled();
            if (kind === "INVOICE")
              expect(
                await prisma.invoice.findUniqueOrThrow({
                  where: { id: f.input.targetId },
                }),
              ).toMatchObject({ status: "VOID", version: 1 });
            else {
              expect(
                await prisma.vehicleTransaction.findUniqueOrThrow({
                  where: { id: f.input.targetId },
                }),
              ).toMatchObject({ status: "CANCELLED", version: 1 });
              expect(
                await prisma.vehicleTransactionStatusHistory.count({
                  where: {
                    vehicleTransactionId: f.input.targetId,
                    toStatus: "CANCELLED",
                  },
                }),
              ).toBe(1);
            }
          } finally {
            resume.release();
            operator.restore();
          }
        }, 15000);
    it("blocks another vehicle purpose while a full payment request exists", async () => {
      const f = await fixture("VEHICLE_TRANSACTION");
      await f.create();
      await expect(
        f.create(randomUUID(), {
          ...f.input,
          targetType: "VEHICLE_TRANSACTION",
          purpose: "VEHICLE_RESERVATION",
        }),
      ).rejects.toMatchObject({ code: "PAYMENT_TARGET_PENDING" });
    });
    it("serializes charging legacy duplicate records across providers and manual methods", async () => {
      const f = await fixture();
      const [first, second] = await Promise.all([f.legacy(), f.legacy()]);
      const results = await Promise.allSettled([
        f.service.initializePaystack(f.actor, first.id, randomUUID(), context()),
        f.service.submitManual(f.actor, second.id, manual(), randomUUID(), context()),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({
        reason: { code: "PAYMENT_TARGET_PENDING" },
      });
      expect(
        await prisma.paymentAttempt.count({
          where: { paymentId: { in: [first.id, second.id] } },
        }),
      ).toBe(1);
      expect(f.initialize.mock.calls.length).toBeLessThanOrEqual(1);
    });
    it("does not treat local expiry as proof that an attempted payment failed", async () => {
      const f = await fixture();
      const old = await f.legacy();
      await f.service.initializePaystack(f.actor, old.id, randomUUID(), context());
      await prisma.payment.update({
        where: { id: old.id },
        data: {
          createdAt: new Date(Date.now() - 60000),
          status: "EXPIRED",
          expiresAt: new Date(Date.now() - 1000),
          expiredAt: new Date(),
        },
      });
      await expect(f.create()).rejects.toMatchObject({ code: "PAYMENT_TARGET_PENDING" });
    });
    it("permits replacing an expired unattempted record without making that record chargeable", async () => {
      const f = await fixture();
      const old = await f.legacy();
      await prisma.payment.update({
        where: { id: old.id },
        data: {
          createdAt: new Date(Date.now() - 60000),
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      await expect(f.create()).resolves.toMatchObject({ replayed: false });
      await expect(
        f.service.initializePaystack(f.actor, old.id, randomUUID(), context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.initialize).not.toHaveBeenCalled();
    });
    it("rejects an already-paid order even when its operational status stays PENDING", async () => {
      const f = await fixture();
      await prisma.order.update({
        where: { id: f.input.targetId },
        data: { paidAt: new Date() },
      });
      await expect(f.create()).rejects.toMatchObject({ statusCode: 409 });
      expect(await f.payments()).toHaveLength(0);
    });
    it("calculates only the remaining vehicle balance after a settled reservation", async () => {
      const f = await fixture("VEHICLE_TRANSACTION");
      const key = randomUUID();
      const reservation = {
        targetType: "VEHICLE_TRANSACTION" as const,
        targetId: f.input.targetId,
        purpose: "VEHICLE_RESERVATION" as const,
      };
      await f.create(key, reservation);
      const first = (await f.payments())[0]!;
      const attempt = await f.service.initializePaystack(
        f.actor,
        first.id,
        randomUUID(),
        context(),
      );
      await f.service.verifyAttempt(f.actor, first.id, attempt.attemptId, context());
      expect(await f.create(key, reservation)).toMatchObject({ replayed: true });
      await f.create(randomUUID(), {
        ...reservation,
        purpose: "VEHICLE_BALANCE_PAYMENT",
      });
      expect((await f.payments()).map((p) => p.amountKobo).sort()).toEqual([
        2500n,
        7500n,
      ]);
    });
    it("keeps original-key intent replay available after settlement and refuses a legacy second charge", async () => {
      const f = await fixture();
      const old = await f.legacy();
      // Both records model pre-fix data; no new duplicates are created through the service.
      const key = randomUUID();
      await prisma.payment.update({
        where: { id: old.id },
        data: {
          expiresAt: new Date(Date.now() - 1000),
          createdAt: new Date(Date.now() - 60000),
        },
      });
      await f.create(key);
      const active = (await f.payments()).find((p) => p.id !== old.id)!;
      const attempt = await f.service.initializePaystack(
        f.actor,
        active.id,
        randomUUID(),
        context(),
      );
      await f.service.verifyAttempt(f.actor, active.id, attempt.attemptId, context());
      expect(await f.create(key)).toMatchObject({ replayed: true });
      await prisma.payment.update({
        where: { id: old.id },
        data: { expiresAt: new Date(Date.now() + 3600000) },
      });
      await expect(
        f.service.initializeMonnify(f.actor, old.id, randomUUID(), context()),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(f.initialize).toHaveBeenCalledTimes(1);
    });
    for (const kind of ["ORDER", "INVOICE", "VEHICLE_TRANSACTION"] as const)
      it(`records both legacy ${kind} captures and flags the surplus without repeating settlement`, async () => {
        const f = await fixture(kind);
        const payments = await Promise.all([f.legacy(), f.legacy()]);
        const attempts = await Promise.all(
          payments.map((payment) =>
            prisma.paymentAttempt.create({
              data: {
                paymentId: payment.id,
                attemptNumber: 1,
                internalReference: `TC-${randomUUID()}`,
                provider: "PAYSTACK",
                status: "PENDING",
                amountKobo: payment.amountKobo,
              },
            }),
          ),
        );
        await Promise.all(
          attempts.map((attempt, i) =>
            f.service.verifyAttempt(f.actor, payments[i]!.id, attempt.id, context()),
          ),
        );
        expect((await f.payments()).map((p) => p.status).sort()).toEqual([
          "REQUIRES_REVIEW",
          "SUCCEEDED",
        ]);
        expect(
          await prisma.paymentLedgerEntry.count({
            where: {
              paymentAttemptId: { in: attempts.map((a) => a.id) },
              type: "CAPTURE",
            },
          }),
        ).toBe(2);
        expect(
          await prisma.paymentAnomaly.count({
            where: {
              paymentId: { in: payments.map((p) => p.id) },
              type: "DUPLICATE_SUCCESS",
            },
          }),
        ).toBe(1);
        // Duplicate provider delivery cannot add another capture or another surplus anomaly.
        await Promise.all(
          attempts.map((attempt, i) =>
            f.service.verifyAttempt(f.actor, payments[i]!.id, attempt.id, context()),
          ),
        );
        expect(
          await prisma.paymentLedgerEntry.count({
            where: {
              paymentAttemptId: { in: attempts.map((a) => a.id) },
              type: "CAPTURE",
            },
          }),
        ).toBe(2);
        expect(
          await prisma.paymentAnomaly.count({
            where: {
              paymentId: { in: payments.map((p) => p.id) },
              type: "DUPLICATE_SUCCESS",
            },
          }),
        ).toBe(1);
        if (kind === "INVOICE")
          expect(
            await prisma.invoice.findUniqueOrThrow({ where: { id: f.input.targetId } }),
          ).toMatchObject({ status: "PAID", version: 1 });
        if (kind === "VEHICLE_TRANSACTION")
          expect(
            await prisma.vehicleTransactionStatusHistory.count({
              where: { vehicleTransactionId: f.input.targetId },
            }),
          ).toBe(1);
      });
    it("pages only the customer's selected vehicle payments and rejects an unrelated cursor", async () => {
      const f = await fixture("VEHICLE_TRANSACTION");
      const [first, second] = await Promise.all([f.legacy(), f.legacy()]);
      const otherCustomer = await fixture("VEHICLE_TRANSACTION");
      const foreign = await otherCustomer.legacy();
      const customerId = (
        await prisma.customerProfile.findUniqueOrThrow({
          where: { userId: f.actor.userId },
        })
      ).id;
      const branchId = (
        await prisma.vehicleTransaction.findUniqueOrThrow({
          where: { id: f.input.targetId },
          select: { vehicleListing: { select: { branchId: true } } },
        })
      ).vehicleListing.branchId;
      const order = await prisma.order.create({
        data: {
          customerId,
          branchId,
          orderNumber: `TC-${randomUUID()}`,
          subtotalKobo: 10000n,
          totalKobo: 10000n,
          customerName: "Isolated Target",
          customerEmail: f.actor.email,
          customerPhone: "+2348000000000",
          paymentDueAt: new Date(Date.now() + 3600000),
        },
      });
      const unrelated = await prisma.payment.create({
        data: {
          customerId,
          orderId: order.id,
          paymentNumber: `TC-${randomUUID()}`,
          idempotencyKeyHash: randomUUID().replaceAll("-", "").padEnd(64, "0"),
          purpose: "ORDER_PAYMENT",
          amountKobo: 10000n,
        },
      });
      const query = { vehicleTransactionId: f.input.targetId, limit: 1 };
      const firstPage = (await f.service.customerList(f.actor, query)) as {
        items: { id: string; vehicleTransactionId: string | null }[];
        nextCursor?: string;
      };
      expect(firstPage.items).toHaveLength(1);
      expect(firstPage.nextCursor).toBe(firstPage.items[0]!.id);
      const nextPage = (await f.service.customerList(f.actor, {
        ...query,
        cursor: firstPage.nextCursor,
      })) as typeof firstPage;
      expect(new Set([...firstPage.items, ...nextPage.items].map((p) => p.id))).toEqual(
        new Set([first.id, second.id]),
      );
      expect(
        [...firstPage.items, ...nextPage.items].every(
          (p) => p.vehicleTransactionId === f.input.targetId,
        ),
      ).toBe(true);
      expect(nextPage.nextCursor).toBeUndefined();
      expect(
        (await f.service.customerList(f.actor, {
          ...query,
          vehicleTransactionId: otherCustomer.input.targetId,
        })) as typeof firstPage,
      ).toMatchObject({ items: [] });
      for (const cursor of [foreign.id, unrelated.id])
        await expect(
          f.service.customerList(f.actor, { ...query, cursor }),
        ).rejects.toMatchObject({
          statusCode: 404,
        });
    });
  },
);
import { testReservationAcceptance } from "../helpers/reservation-terms.js";
