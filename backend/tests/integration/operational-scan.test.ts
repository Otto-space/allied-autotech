import { randomUUID, createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";
import { OperationalAlertsWorker } from "../../src/workers/operational-alerts.worker.js";
import {
  advanceOperationalScan,
  readOperationalScan,
} from "../../src/workers/operational-scan.js";

const hash = () => createHash("sha256").update(randomUUID()).digest("hex");
const at = new Date("1900-01-01T00:00:00Z");

// Keep financial evidence and global scan positions isolated without deleting
// protected records or committing a policy/financial state change.
async function isolated(
  work: (database: PrismaClient, tx: Prisma.TransactionClient) => Promise<void>,
) {
  const rollback = new Error("synthetic rollback");
  try {
    await prisma.$transaction(
      async (tx) => {
        const database = new Proxy(prisma, {
          get(_target, property) {
            if (property === "$transaction")
              return <T>(callback: (client: Prisma.TransactionClient) => Promise<T>) =>
                callback(tx);
            return Reflect.get(tx, property);
          },
        });
        await tx.workerScanCheckpoint.deleteMany({
          where: { name: { startsWith: "operational-alerts:" } },
        });
        await work(database, tx);
        throw rollback;
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

async function paymentFixture(tx: Prisma.TransactionClient, count: number) {
  const branch = await tx.branch.create({
    data: {
      name: "Synthetic Scan",
      code: randomUUID().slice(0, 12),
      address: "Synthetic",
      city: "Synthetic",
      state: "Synthetic",
    },
  });
  const customer = await tx.customerProfile.create({
    data: {
      firstName: "Synthetic",
      lastName: "Scan",
      phone: "+2348000000000",
      user: {
        create: { email: `${randomUUID()}@example.test`, passwordHash: "unusable" },
      },
    },
  });
  const order = await tx.order.create({
    data: {
      branchId: branch.id,
      customerId: customer.id,
      orderNumber: randomUUID(),
      customerName: "Synthetic Scan",
      customerEmail: "scan@example.test",
      customerPhone: "+2348000000000",
      subtotalKobo: 10000n,
      totalKobo: 10000n,
    },
  });
  const ids = Array.from({ length: count }, () => randomUUID()).sort();
  await tx.payment.createMany({
    data: ids.map((id) => ({
      id,
      orderId: order.id,
      customerId: customer.id,
      paymentNumber: randomUUID(),
      purpose: "ORDER_PAYMENT",
      amountKobo: 10000n,
      status: "PROCESSING",
      idempotencyKeyHash: hash(),
      createdAt: at,
    })),
  });
  return ids;
}

describe.skipIf(
  process.env["RUN_DATABASE_TESTS"] !== "true" ||
    process.env["RUN_OPERATIONAL_SCAN_TESTS"] !== "true",
)("durable operational alert scans", () => {
  afterAll(() => prisma.$disconnect());
  it.each([{ afterCreatedAt: at }, { afterId: randomUUID() }, { version: 0 }])(
    "rejects invalid persisted checkpoint %j",
    async (data) => {
      const name = `synthetic-scan:${randomUUID()}`;
      try {
        await expect(
          prisma.workerScanCheckpoint.create({ data: { name, ...data } }),
        ).rejects.toThrow(/WorkerScanCheckpoint_/u);
      } finally {
        await prisma.workerScanCheckpoint.deleteMany({ where: { name } });
      }
    },
  );
  it(
    "reaches all four queues beyond 100 tied rows across worker restarts, then revisits older records",
    async () =>
      isolated(async (database, tx) => {
        const payments = await paymentFixture(tx, 101);
        const attempt = await tx.paymentAttempt.create({
          data: {
            paymentId: payments[0]!,
            attemptNumber: 1,
            internalReference: randomUUID(),
            provider: "PAYSTACK",
            amountKobo: 10000n,
            status: "SUCCESSFUL",
            verificationStatus: "VERIFIED",
            verifiedAmountKobo: 10000n,
            verifiedCurrency: "NGN",
            gatewayTransactionId: randomUUID(),
            providerReference: randomUUID(),
            paidAt: new Date(),
            verifiedAt: new Date(),
          },
        });
        const refunds = Array.from({ length: 101 }, () => randomUUID()).sort();
        const requester = await tx.user.create({
          data: {
            email: `${randomUUID()}@example.test`,
            passwordHash: "unusable",
            role: "ADMIN",
          },
        });
        await tx.refund.createMany({
          data: refunds.map((id) => ({
            id,
            paymentAttemptId: attempt.id,
            refundNumber: randomUUID(),
            idempotencyKeyHash: hash(),
            amountKobo: 1n,
            status: "REQUESTED",
            requestedByUserId: requester.id,
            dueAt: at,
            reason: "Synthetic scan",
            createdAt: at,
          })),
        });
        const disputes = Array.from({ length: 101 }, () => randomUUID()).sort();
        await tx.paymentDispute.createMany({
          data: disputes.map((id) => ({
            id,
            paymentAttemptId: attempt.id,
            provider: "PAYSTACK",
            providerDisputeId: randomUUID(),
            status: "AWAITING_RESPONSE",
            category: "OTHER",
            amountKobo: 1n,
            openedAt: at,
            createdAt: at,
          })),
        });
        const branch = await tx.branch.create({
          data: {
            name: "Synthetic Scan",
            code: randomUUID().slice(0, 12),
            address: "Synthetic",
            city: "Synthetic",
            state: "Synthetic",
          },
        });
        const vehicles = Array.from({ length: 101 }, () => randomUUID());
        await tx.vehicle.createMany({
          data: vehicles.map((id) => ({
            id,
            branchId: branch.id,
            stockNumber: randomUUID(),
            make: "Synthetic",
            model: "Scan",
            year: 2020,
          })),
        });
        const listings = vehicles.map(() => randomUUID());
        await tx.vehicleListing.createMany({
          data: listings.map((id, i) => ({
            id,
            vehicleId: vehicles[i]!,
            branchId: branch.id,
            title: "Synthetic scan",
            slug: randomUUID(),
            priceKobo: 10000n,
          })),
        });
        const holds = Array.from({ length: 101 }, () => randomUUID()).sort();
        const owner =
          (await tx.user.findFirst({ where: { role: "SUPER_ADMIN" } })) ??
          (await tx.user.create({
            data: {
              email: `${randomUUID()}@example.test`,
              passwordHash: "unusable",
              role: "SUPER_ADMIN",
              emailVerifiedAt: new Date(),
            },
          }));
        const key = "vehicle_reservation_terms";
        const prior = await tx.businessPolicyVersion.findFirst({
          where: { key },
          orderBy: { version: "desc" },
        });
        const terms = await tx.businessPolicyVersion.create({
          data: {
            key,
            version: (prior?.version ?? 0) + 1,
            approvalStatus: "APPROVED",
            approvedByUserId: owner.id,
            source: "Synthetic rollback-only fixture",
            sourceQuestion: "Q3",
            approvalEvidence:
              "Synthetic rollback-only test approval, not business approval",
            effectiveAt: new Date(),
            settings: {
              enabled: true,
              title: "Synthetic",
              body: "Synthetic rollback-only fixture, not an approved agreement.",
            },
          },
        });
        const buyer = await tx.payment.findUniqueOrThrow({
          where: { id: payments[0]! },
          include: { customer: true },
        });
        await tx.vehicleTransaction.createMany({
          data: holds.map((id, i) => ({
            id,
            vehicleListingId: listings[i]!,
            transactionNumber: randomUUID(),
            customerName: "Synthetic Scan",
            customerPhone: "+2348000000000",
            askingPriceKobo: 10000n,
            agreedPriceKobo: 10000n,
            customerId: buyer.customer!.id,
            termsVersion: terms.id,
            termsAcceptedAt: new Date(),
            reservationTermsPolicyId: terms.id,
            reservationTermsAcceptedByUserId: buyer.customer!.userId,
            status: "PAID",
            paidAt: new Date(),
            createdAt: at,
          })),
        });
        const queues = [
          ["stuck-payment", payments],
          ["refund", refunds],
          ["dispute", disputes],
          ["vehicle-hold", holds],
        ] as const;
        await new OperationalAlertsWorker(database).runOnce();
        for (const [prefix, ids] of queues) {
          const alerts = await tx.operationalAlert.findMany({
            where: { key: { in: ids.map((id) => `${prefix}:${id}`) } },
            select: { resourceId: true },
          });
          expect(alerts.map((a) => a.resourceId).sort()).toEqual(ids.slice(0, 100));
        }
        // The anchor stops matching between pages; the saved values still advance.
        await tx.payment.update({
          where: { id: payments[99]! },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        await new OperationalAlertsWorker(database).runOnce();
        for (const [prefix, ids] of queues)
          expect(
            await tx.operationalAlert.count({
              where: { key: { in: ids.map((id) => `${prefix}:${id}`) } },
            }),
          ).toBe(101);
        const checkpoint = await readOperationalScan(database, "payments");
        expect(checkpoint.afterId).toBeNull();
        // An older record becomes actionable again; a completed sweep must wrap.
        await tx.operationalAlert.update({
          where: { key: `stuck-payment:${payments[0]}` },
          data: { resolvedAt: new Date() },
        });
        await new OperationalAlertsWorker(database).runOnce();
        expect(
          (
            await tx.operationalAlert.findUniqueOrThrow({
              where: { key: `stuck-payment:${payments[0]}` },
            })
          ).resolvedAt,
        ).toBeNull();
      }),
    120_000,
  );

  it("fences a stale scanner's checkpoint update", async () =>
    isolated(async (database) => {
      const original = await readOperationalScan(database, "payments");
      const rows = Array.from({ length: 100 }, () => ({
        id: randomUUID(),
        createdAt: at,
      }));
      await advanceOperationalScan(database, original, rows);
      const newer = await readOperationalScan(database, "payments");
      await advanceOperationalScan(database, newer, []);
      await advanceOperationalScan(database, original, rows);
      expect(await readOperationalScan(database, "payments")).toMatchObject({
        afterId: null,
        version: original.version + 2,
      });
    }));

  it("does not advance past a failed alert write and safely retries prior writes", async () =>
    isolated(async (database, tx) => {
      const payments = await paymentFixture(tx, 2);
      const working = database.operationalAlert;
      let fail = true;
      const failing = new Proxy(database, {
        get(target, property) {
          if (property !== "operationalAlert") return Reflect.get(target, property);
          return new Proxy(working, {
            get(delegate, method) {
              if (method !== "upsert") return Reflect.get(delegate, method);
              return (args: Prisma.OperationalAlertUpsertArgs) => {
                if (fail && args.where.key === `stuck-payment:${payments[1]}`)
                  throw new Error("synthetic alert failure");
                return delegate.upsert(args);
              };
            },
          });
        },
      });
      await expect(new OperationalAlertsWorker(failing).runOnce()).rejects.toThrow(
        "synthetic alert failure",
      );
      expect(await readOperationalScan(database, "payments")).toMatchObject({
        afterId: null,
        version: 1,
      });
      fail = false;
      await new OperationalAlertsWorker(failing).runOnce();
      expect(
        await tx.operationalAlert.count({
          where: { key: { in: payments.map((id) => `stuck-payment:${id}`) } },
        }),
      ).toBe(2);
    }));
});
