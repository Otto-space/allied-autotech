import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { RefundWorker } from "../../src/workers/refund.worker.js";
import { databaseTimezones, timezoneDatabase } from "../helpers/timezone-database.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type {
  PaymentProviderPort,
  VerifiedRefund,
} from "../../src/providers/payments/payment-provider.port.js";
const digest = () => createHash("sha256").update(randomUUID()).digest("hex");
type Provider = "PAYSTACK" | "MONNIFY";
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
function worker(verifyRefund: NonNullable<PaymentProviderPort["verifyRefund"]>) {
  const provider: PaymentProviderPort = {
    initialize: vi.fn(),
    verify: vi.fn(),
    refund: vi.fn(async () => {
      throw new Error("No submission permitted in poll tests");
    }),
    verifyRefund,
  };
  return {
    worker: new RefundWorker(
      prisma,
      new PaymentProviderRegistry({ PAYSTACK: provider, MONNIFY: provider }),
    ),
    provider,
  };
}
async function fixture(provider: Provider) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable",
      profile: {
        create: { firstName: "Refund", lastName: "Observation", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const approver = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable",
      role: "ADMIN",
    },
  });
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Refund test",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      customerId: user.profile!.id,
      orderNumber: randomUUID(),
      customerName: "Refund Observation",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 10000n,
      totalKobo: 10000n,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      customerId: user.profile!.id,
      orderId: order.id,
      paymentNumber: randomUUID(),
      purpose: "ORDER_PAYMENT",
      amountKobo: 10000n,
      idempotencyKeyHash: digest(),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      internalReference: randomUUID(),
      provider,
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
  const refund = await prisma.refund.create({
    data: {
      paymentAttemptId: attempt.id,
      requestedByUserId: user.id,
      approvedByUserId: approver.id,
      approvedAt: new Date(),
      status: "PENDING",
      refundNumber: randomUUID(),
      idempotencyKeyHash: digest(),
      amountKobo: 1000n,
      reason: "Synthetic approved refund",
      providerRefundId: randomUUID(),
      nextReconcileAt: new Date(0),
    },
  });
  const exact: VerifiedRefund = {
    providerRefundId: refund.providerRefundId!,
    status: "succeeded",
    amountKobo: refund.amountKobo,
    currency: refund.currency,
  };
  const snapshot = () => prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
  const ledger = () =>
    prisma.paymentLedgerEntry.findMany({ where: { refundId: refund.id } });
  const anomalies = () =>
    prisma.paymentAnomaly.findMany({
      where: { refundId: refund.id, type: "REFUND_MISMATCH" },
    });
  return { refund, exact, snapshot, ledger, anomalies };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Refund poll ownership",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(() => prisma.$disconnect());

    it.each([false, true])(
      "protects a fresh exhausted claim and holds an expired one (fresh=%s)",
      async (fresh) => {
        const f = await fixture("PAYSTACK");
        await prisma.refund.update({
          where: { id: f.refund.id },
          data: {
            reconciliationFailures: 8,
            reconciliationToken: randomUUID(),
            reconciliationLeaseUntil: new Date(fresh ? Date.now() + 600000 : 0),
          },
        });
        const before = await f.snapshot();
        const verify = vi.fn(async () => f.exact),
          w = worker(verify);
        expect(await w.worker.runOnce(1, f.refund.id)).toMatchObject({ reconciled: 0 });
        expect(verify).not.toHaveBeenCalled();
        if (fresh) expect(await f.snapshot()).toEqual(before);
        else
          expect(await f.snapshot()).toMatchObject({
            status: "NEEDS_ATTENTION",
            reconciliationFailures: 8,
            nextReconcileAt: null,
            reconciliationToken: null,
            reconciliationLeaseUntil: null,
          });
      },
    );

    it.each(["pending", "failed", "succeeded", "error"] as const)(
      "ignores a late %s result after an expired poll is replaced",
      async (status) => {
        const f = await fixture("PAYSTACK"),
          started = gate(),
          finish = gate();
        await prisma.refund.update({
          where: { id: f.refund.id },
          data: { reconciliationFailures: 6 },
        });
        const old = worker(async () => {
          started.release();
          await finish.promise;
          if (status === "error") throw new Error("Late provider failure");
          return { ...f.exact, status };
        });
        const run = old.worker.runOnce(1, f.refund.id);
        try {
          await started.promise;
          const first = await f.snapshot();
          expect(first.reconciliationToken).toBeTruthy();
          await prisma.refund.update({
            where: { id: f.refund.id },
            data: { reconciliationLeaseUntil: new Date(0) },
          });
          const newer = worker(async () => ({ ...f.exact, status: "pending" }));
          expect(await newer.worker.runOnce(1, f.refund.id)).toMatchObject({
            reconciled: 1,
          });
          const settled = await f.snapshot();
          expect(settled).toMatchObject({
            status: "PENDING",
            reconciliationFailures: 0,
            reconciliationToken: null,
            reconciliationLeaseUntil: null,
          });
          finish.release();
          await run;
          expect(await f.snapshot()).toEqual(settled);
          expect(await f.ledger()).toHaveLength(0);
          expect(old.provider.refund).not.toHaveBeenCalled();
          expect(newer.provider.refund).not.toHaveBeenCalled();
        } finally {
          finish.release();
          await run;
        }
      },
    );

    it("does not let an old failure release or exhaust a newer live claim", async () => {
      const f = await fixture("PAYSTACK"),
        oldStarted = gate(),
        newStarted = gate(),
        oldFinish = gate(),
        newFinish = gate();
      await prisma.refund.update({
        where: { id: f.refund.id },
        data: { reconciliationFailures: 7 },
      });
      const old = worker(async () => {
        oldStarted.release();
        await oldFinish.promise;
        throw new Error("Old failure");
      });
      const newer = worker(async () => {
        newStarted.release();
        await newFinish.promise;
        return { ...f.exact, status: "pending" };
      });
      const first = old.worker.runOnce(1, f.refund.id);
      let second: Promise<unknown> | undefined;
      try {
        await oldStarted.promise;
        await prisma.refund.update({
          where: { id: f.refund.id },
          data: { reconciliationLeaseUntil: new Date(0) },
        });
        second = newer.worker.runOnce(1, f.refund.id);
        await newStarted.promise;
        const claim = await f.snapshot();
        oldFinish.release();
        await first;
        expect(await f.snapshot()).toEqual(claim);
        newFinish.release();
        await second;
        expect(await f.snapshot()).toMatchObject({
          status: "PENDING",
          reconciliationFailures: 0,
        });
      } finally {
        oldFinish.release();
        newFinish.release();
        await Promise.all([first, second]);
      }
    });

    it("recovers an expired crash claim, backs off actual failures and holds after eight", async () => {
      const f = await fixture("MONNIFY");
      await prisma.refund.update({
        where: { id: f.refund.id },
        data: {
          reconciliationToken: randomUUID(),
          reconciliationLeaseUntil: new Date(0),
        },
      });
      const verify = vi.fn(async () => {
        throw new Error("Synthetic outage");
      });
      const w = worker(verify);
      for (let attempt = 1; attempt <= 8; attempt++) {
        const before = Date.now();
        expect(await w.worker.runOnce(1, f.refund.id)).toMatchObject({ reconciled: 1 });
        const row = await f.snapshot();
        expect(row).toMatchObject({
          reconciliationFailures: attempt,
          reconciliationToken: null,
          reconciliationLeaseUntil: null,
        });
        if (attempt < 8) {
          const backoff = Math.min(3600000, 60000 * 2 ** (attempt - 1));
          expect(row.nextReconcileAt!.getTime()).toBeGreaterThanOrEqual(before + backoff);
          expect(row.nextReconcileAt!.getTime()).toBeLessThanOrEqual(
            Date.now() + backoff,
          );
          expect(await w.worker.runOnce(1, f.refund.id)).toMatchObject({ reconciled: 0 });
          await prisma.refund.update({
            where: { id: f.refund.id },
            data: { nextReconcileAt: new Date(0) },
          });
        } else
          expect(row).toMatchObject({ status: "NEEDS_ATTENTION", nextReconcileAt: null });
      }
      expect(verify).toHaveBeenCalledTimes(8);
      expect(w.provider.refund).not.toHaveBeenCalled();
    });

    it.each(databaseTimezones)(
      "uses UTC claim expiry under a %s database session",
      async (timezone) => {
        const f = await fixture("PAYSTACK"),
          database = timezoneDatabase(timezone);
        const before = Date.now();
        const verify = vi.fn(async () => {
          const row = await f.snapshot();
          expect(row.reconciliationLeaseUntil!.getTime()).toBeGreaterThanOrEqual(
            before + 599000,
          );
          expect(row.reconciliationLeaseUntil!.getTime()).toBeLessThanOrEqual(
            Date.now() + 601000,
          );
          return f.exact;
        });
        try {
          const providers = new PaymentProviderRegistry({
            PAYSTACK: {
              initialize: vi.fn(),
              verify: vi.fn(),
              refund: vi.fn(),
              verifyRefund: verify,
            },
          });
          expect(
            await new RefundWorker(database, providers).runOnce(1, f.refund.id),
          ).toMatchObject({ reconciled: 1 });
          expect(verify).toHaveBeenCalledTimes(1);
          expect(await f.snapshot()).toMatchObject({
            status: "SUCCEEDED",
            reconciliationToken: null,
            reconciliationLeaseUntil: null,
          });
          expect(await f.ledger()).toHaveLength(1);
        } finally {
          await database.$disconnect();
        }
      },
    );

    it("enforces paired claim fields and clears claims when verification requires review", async () => {
      const f = await fixture("PAYSTACK");
      await expect(
        prisma.refund.update({
          where: { id: f.refund.id },
          data: { reconciliationToken: randomUUID() },
        }),
      ).rejects.toThrow();
      await expect(
        prisma.refund.update({
          where: { id: f.refund.id },
          data: { reconciliationLeaseUntil: new Date() },
        }),
      ).rejects.toThrow();
      const w = worker(async () => ({ ...f.exact, amountKobo: 2000n }));
      await w.worker.runOnce(1, f.refund.id);
      expect(await f.snapshot()).toMatchObject({
        status: "NEEDS_ATTENTION",
        nextReconcileAt: null,
        reconciliationToken: null,
        reconciliationLeaseUntil: null,
      });
      expect(await f.anomalies()).toHaveLength(1);
      expect(await f.ledger()).toHaveLength(0);
    });

    it("allows only one overlapping poll and counts a provider failure once", async () => {
      const f = await fixture("PAYSTACK"),
        started = gate(),
        finish = gate();
      const verify = vi.fn(async () => {
        started.release();
        await finish.promise;
        throw new Error("Synthetic provider outage");
      });
      const w = worker(verify);
      const first = w.worker.runOnce(1, f.refund.id);
      try {
        await started.promise;
        const second = w.worker.runOnce(1, f.refund.id);
        // The overlapping worker must finish without entering the provider.
        const state = await Promise.race([
          second,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
        ]);
        finish.release();
        await Promise.all([first, second]);
        expect(state).toMatchObject({ reconciled: 0 });
        expect(verify).toHaveBeenCalledTimes(1);
        expect((await f.snapshot()).reconciliationFailures).toBe(1);
        expect(w.provider.refund).not.toHaveBeenCalled();
      } finally {
        finish.release();
        await first;
      }
    });

    it("does not inflate an exhausted poll budget when two workers race", async () => {
      const f = await fixture("PAYSTACK");
      await prisma.refund.update({
        where: { id: f.refund.id },
        data: { reconciliationFailures: 7 },
      });
      const verify = vi.fn(async () => {
        throw new Error("Synthetic outage");
      });
      const w = worker(verify);
      await Promise.all([
        w.worker.runOnce(1, f.refund.id),
        w.worker.runOnce(1, f.refund.id),
      ]);
      expect(verify).toHaveBeenCalledTimes(1);
      expect(await f.snapshot()).toMatchObject({
        status: "NEEDS_ATTENTION",
        reconciliationFailures: 8,
        nextReconcileAt: null,
      });
    });

    it("skips a row rescheduled after discovery instead of polling an obsolete batch", async () => {
      const f = await fixture("PAYSTACK");
      const original = prisma.refund.findMany.bind(prisma.refund);
      const schedule = new Date(Date.now() + 3600000);
      vi.spyOn(prisma.refund, "findMany").mockImplementationOnce(async (...args) => {
        const rows = await original(...args);
        await prisma.refund.update({
          where: { id: f.refund.id },
          data: { nextReconcileAt: schedule },
        });
        return rows;
      });
      const verify = vi.fn(async () => ({ ...f.exact, status: "pending" as const }));
      const w = worker(verify);
      expect(await w.worker.runOnce(1, f.refund.id)).toMatchObject({ reconciled: 0 });
      expect(verify).not.toHaveBeenCalled();
      expect((await f.snapshot()).nextReconcileAt).toEqual(schedule);
    });
  },
);
