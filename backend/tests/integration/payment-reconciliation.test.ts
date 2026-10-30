import { randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client as PgClient } from "pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { PaymentProviderRegistry } from "../../src/providers/payments/payment-provider.registry.js";
import type {
  PaymentProviderPort,
  VerifiedPayment,
} from "../../src/providers/payments/payment-provider.port.js";
import { PaymentReconciliationWorker } from "../../src/workers/reconciliation.worker.js";

async function fixture() {
  const periodStart = new Date(Date.UTC(2000, 0, 1) + randomInt(500_000_000_000));
  const periodEnd = new Date(periodStart.getTime() + 1000);
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable-synthetic-only",
      profile: {
        create: {
          firstName: "Synthetic",
          lastName: "Reconciliation",
          phone: "+2348000000000",
        },
      },
    },
    include: { profile: true },
  });
  const branch = await prisma.branch.create({
    data: {
      code: `RC-${randomUUID().slice(0, 8)}`,
      name: "Synthetic reconciliation",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      customerId: user.profile!.id,
      branchId: branch.id,
      orderNumber: `RC-${randomUUID()}`,
      subtotalKobo: 10000n,
      totalKobo: 10000n,
      customerName: "Synthetic Reconciliation",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
    },
  });
  const payment = await prisma.payment.create({
    data: {
      customerId: user.profile!.id,
      orderId: order.id,
      paymentNumber: `RC-${randomUUID()}`,
      purpose: "ORDER_PAYMENT",
      amountKobo: 10000n,
      idempotencyKeyHash: randomUUID().replaceAll("-", "").repeat(2),
    },
  });
  const observations = new Map<string, Partial<VerifiedPayment> | Error>();
  const verify = vi.fn<PaymentProviderPort["verify"]>(async (reference) => {
    const observation = observations.get(reference);
    if (observation instanceof Error) throw observation;
    return {
      reference,
      gatewayTransactionId: `synthetic-${reference}`,
      status: "pending",
      amountKobo: 10000n,
      currency: "NGN",
      paidAt: null,
      providerFeeKobo: null,
      method: null,
      ...observation,
    };
  });
  const provider: PaymentProviderPort = {
    verify,
    async initialize(): Promise<never> {
      throw new Error("No checkout allowed");
    },
    async refund(): Promise<never> {
      throw new Error("No refund allowed");
    },
  };
  const worker = new PaymentReconciliationWorker(
    prisma,
    new PaymentProviderRegistry({ PAYSTACK: provider, MONNIFY: provider }),
  );
  let number = 0;
  function data(
    overrides: Partial<Prisma.PaymentAttemptCreateManyInput> = {},
  ): Prisma.PaymentAttemptCreateManyInput {
    const reference = `RC-${randomUUID()}`;
    return {
      id: randomUUID(),
      paymentId: payment.id,
      attemptNumber: ++number,
      internalReference: reference,
      providerReference: reference,
      provider: "PAYSTACK",
      amountKobo: 10000n,
      status: "PENDING",
      initiatedAt: periodStart,
      ...overrides,
    };
  }
  async function attempt(
    overrides: Partial<Prisma.PaymentAttemptCreateManyInput> = {},
    observation: Partial<VerifiedPayment> | Error = {},
  ) {
    const record = await prisma.paymentAttempt.create({ data: data(overrides) });
    observations.set(
      record.internalReference,
      observation instanceof Error
        ? observation
        : {
            gatewayTransactionId:
              record.gatewayTransactionId ?? `synthetic-${record.internalReference}`,
            ...observation,
          },
    );
    return record;
  }
  const confirmed = (
    amountKobo = 10000n,
  ): Partial<Prisma.PaymentAttemptCreateManyInput> => ({
    status: "SUCCESSFUL",
    verificationStatus: amountKobo === 10000n ? "VERIFIED" : "MISMATCH",
    verifiedAmountKobo: amountKobo,
    verifiedCurrency: "NGN",
    verifiedAt: new Date(),
    paidAt: new Date(),
    gatewayTransactionId: randomUUID(),
  });
  const run = () => worker.run(periodStart, periodEnd);
  const items = (runId: string) =>
    prisma.paymentReconciliationItem.findMany({ where: { runId } });
  return {
    worker,
    run,
    items,
    data,
    attempt,
    confirmed,
    payment,
    verify,
    periodStart,
    periodEnd,
  };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "payment reconciliation accounting",
  () => {
    afterEach(() => vi.restoreAllMocks());
    afterAll(() => prisma.$disconnect());

    it("does not attach a reversal for a different reference to this payment", async () => {
      const f = await fixture();
      const attempt = await f.attempt(
        {},
        { status: "reversed", reference: "another-reference" },
      );
      const run = await f.run();
      expect(await f.items(run.id)).toEqual([
        expect.objectContaining({ status: "STATUS_MISMATCH", providerAmountKobo: null }),
      ]);
      expect(
        await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
      ).toEqual(attempt);
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
      ).toEqual(f.payment);
      expect(
        await prisma.paymentAnomaly.count({ where: { paymentId: f.payment.id } }),
      ).toBe(0);
    });

    it("includes every attempt beyond 1,000, handles tied timestamps and excludes other providers and period boundaries", async () => {
      const f = await fixture();
      await prisma.paymentAttempt.createMany({
        data: Array.from({ length: 1003 }, () => f.data()),
      });
      await f.attempt({ provider: "MONNIFY" });
      await f.attempt({ initiatedAt: new Date(f.periodStart.getTime() - 1) });
      await f.attempt({ initiatedAt: f.periodEnd });
      const run = await f.run();
      expect(run).toMatchObject({
        status: "MATCHED",
        matchedCount: 1003,
        differenceCount: 0,
        internalTotalKobo: 0n,
        providerTotalKobo: 0n,
      });
      expect(f.verify).toHaveBeenCalledTimes(1003);
      const items = await f.items(run.id);
      expect(new Set(items.map((item) => item.paymentAttemptId)).size).toBe(1003);
      expect(
        items.every(
          (item) => item.internalAmountKobo === 0n && item.providerAmountKobo === 0n,
        ),
      ).toBe(true);
      expect(await f.worker.run(f.periodStart, f.periodEnd, "MONNIFY")).toMatchObject({
        status: "MATCHED",
        matchedCount: 1,
      });
    }, 60000);

    it("totals confirmed receipts instead of requested amounts and retains underpayment as a difference", async () => {
      const f = await fixture();
      await f.attempt(f.confirmed(9999n), { status: "success", amountKobo: 9999n });
      await f.attempt(f.confirmed(), { status: "success" });
      const before = await prisma.paymentAttempt.findMany({
        where: { paymentId: f.payment.id },
      });
      const run = await f.run();
      expect(run).toMatchObject({
        status: "DIFFERENCES_FOUND",
        matchedCount: 1,
        differenceCount: 1,
        internalTotalKobo: 19999n,
        providerTotalKobo: 19999n,
      });
      expect(await f.items(run.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "AMOUNT_MISMATCH",
            internalAmountKobo: 9999n,
            providerAmountKobo: 9999n,
          }),
        ]),
      );
      expect(
        await prisma.paymentAttempt.findMany({ where: { paymentId: f.payment.id } }),
      ).toEqual(before);
      expect(
        await prisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }),
      ).toEqual(f.payment);
      expect(
        await prisma.paymentLedgerEntry.count({
          where: { paymentAttempt: { paymentId: f.payment.id } },
        }),
      ).toBe(0);
    });

    it.each([
      [{ currency: "USD", amountKobo: 500n }, "CURRENCY_MISMATCH"],
      [{ reference: "wrong-reference" }, "STATUS_MISMATCH"],
      [{ amountKobo: 0n }, "AMOUNT_MISMATCH"],
      [{ amountKobo: -100n }, "AMOUNT_MISMATCH"],
    ] as const)(
      "excludes an unallocatable provider receipt from NGN totals (case %#)",
      async (observation, status) => {
        const f = await fixture();
        await f.attempt({}, { status: "success", ...observation });
        const run = await f.run();
        expect(run).toMatchObject({
          status: "DIFFERENCES_FOUND",
          differenceCount: 1,
          internalTotalKobo: 0n,
          providerTotalKobo: 0n,
        });
        expect(await f.items(run.id)).toEqual([
          expect.objectContaining({
            status,
            providerAmountKobo: null,
            internalAmountKobo: 0n,
          }),
        ]);
      },
    );

    it("retains confirmed local funds when the provider returns another reference", async () => {
      const f = await fixture();
      await f.attempt(f.confirmed(), {
        status: "success",
        reference: "another-payment-reference",
      });
      const run = await f.run();
      expect(run).toMatchObject({
        status: "DIFFERENCES_FOUND",
        matchedCount: 0,
        differenceCount: 1,
        internalTotalKobo: 10000n,
        providerTotalKobo: 0n,
      });
      expect(await f.items(run.id)).toEqual([
        expect.objectContaining({
          status: "STATUS_MISMATCH",
          internalAmountKobo: 10000n,
          providerAmountKobo: null,
          note: "Provider returned a different reference; excluded from NGN totals",
        }),
      ]);
    });

    it("retains confirmed local funds and retries an unavailable provider without treating it as a missing receipt", async () => {
      const f = await fixture();
      const attempt = await f.attempt(
        f.confirmed(),
        new Error("synthetic-private-provider-error"),
      );
      await expect(f.run()).rejects.toThrow("Provider verification unavailable");
      const failed = await prisma.paymentReconciliationRun.findFirstOrThrow({
        where: {
          provider: "PAYSTACK",
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
        },
      });
      expect(failed).toMatchObject({ status: "FAILED", attemptNumber: 1 });
      expect(failed.failureMessage).not.toContain("synthetic-private-provider-error");
      expect(await f.items(failed.id)).toEqual([]);
      f.verify.mockResolvedValueOnce({
        reference: attempt.internalReference,
        gatewayTransactionId: attempt.gatewayTransactionId!,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt: new Date(),
        providerFeeKobo: null,
        method: null,
      });
      const recovered = await f.run();
      expect(recovered).toMatchObject({
        status: "MATCHED",
        attemptNumber: 2,
        internalTotalKobo: 10000n,
        providerTotalKobo: 10000n,
      });
    });

    it("distinguishes pending from failed even when neither side reports a capture", async () => {
      const f = await fixture();
      await f.attempt({}, { status: "failed" });
      const run = await f.run();
      expect(run).toMatchObject({ status: "DIFFERENCES_FOUND", differenceCount: 1 });
      expect(await f.items(run.id)).toEqual([
        expect.objectContaining({
          status: "STATUS_MISMATCH",
          providerAmountKobo: 0n,
          internalAmountKobo: 0n,
        }),
      ]);
    });

    it("does not mark a held attempt as matched after a later pending result", async () => {
      const f = await fixture();
      await f.attempt({
        status: "PROCESSING",
        redactedGatewayData: { verificationHold: true },
      });
      expect(await f.run()).toMatchObject({
        status: "DIFFERENCES_FOUND",
        differenceCount: 1,
      });
    });

    it("retains conflicting amounts and gateway identities as differences", async () => {
      const f = await fixture();
      await f.attempt(f.confirmed(9999n), { status: "success" });
      await f.attempt(f.confirmed(), {
        status: "success",
        gatewayTransactionId: "different-transaction",
      });
      const run = await f.run();
      expect(run).toMatchObject({
        status: "DIFFERENCES_FOUND",
        differenceCount: 2,
        internalTotalKobo: 19999n,
        providerTotalKobo: 20000n,
      });
      expect((await f.items(run.id)).map((item) => item.status).sort()).toEqual([
        "AMOUNT_MISMATCH",
        "STATUS_MISMATCH",
      ]);
    });

    it("keeps attempts created after the run began out of later pages", async () => {
      const f = await fixture();
      await prisma.paymentAttempt.createMany({
        data: Array.from({ length: 501 }, (_, index) =>
          f.data({ initiatedAt: new Date(f.periodStart.getTime() + index) }),
        ),
      });

      const original = f.verify.getMockImplementation()!;
      f.verify.mockImplementationOnce(async (reference) => {
        await f.attempt({
          initiatedAt: new Date(f.periodStart.getTime() + 900),
          createdAt: new Date(Date.now() + 10000),
        });
        return original(reference);
      });
      expect(await f.run()).toMatchObject({
        status: "MATCHED",
        matchedCount: 501,
        differenceCount: 0,
      });
      expect(f.verify).toHaveBeenCalledTimes(501);
    });

    it("does not count a provider receipt already confirmed for an attempt outside the selected period", async () => {
      const f = await fixture();
      const gatewayTransactionId = randomUUID();
      await f.attempt({
        ...f.confirmed(),
        gatewayTransactionId,
        initiatedAt: new Date(f.periodStart.getTime() - 1),
      });
      await f.attempt({}, { status: "success", gatewayTransactionId });
      const run = await f.run();
      expect(run).toMatchObject({
        status: "DIFFERENCES_FOUND",
        differenceCount: 1,
        providerTotalKobo: 0n,
        internalTotalKobo: 0n,
      });
      expect(await f.items(run.id)).toEqual([
        expect.objectContaining({ status: "STATUS_MISMATCH", providerAmountKobo: null }),
      ]);
    });

    it("counts a repeated unconfirmed provider receipt only once across reconciliation batches", async () => {
      const f = await fixture();
      const gatewayTransactionId = randomUUID();
      await f.attempt({}, { status: "success", gatewayTransactionId });
      await prisma.paymentAttempt.createMany({
        data: Array.from({ length: 499 }, () =>
          f.data({ initiatedAt: new Date(f.periodStart.getTime() + 1) }),
        ),
      });
      await f.attempt(
        { initiatedAt: new Date(f.periodStart.getTime() + 900) },
        { status: "success", gatewayTransactionId },
      );
      const run = await f.run();
      expect(run).toMatchObject({
        status: "DIFFERENCES_FOUND",
        differenceCount: 2,
        matchedCount: 499,
        providerTotalKobo: 10000n,
        internalTotalKobo: 0n,
      });
      const items = await f.items(run.id);
      expect(items.filter((item) => item.providerAmountKobo === 10000n)).toHaveLength(1);
      expect(items.filter((item) => item.providerAmountKobo === null)).toHaveLength(1);
    });

    it("validates the interval before creating any run", async () => {
      const f = await fixture();
      const create = vi.spyOn(prisma.paymentReconciliationRun, "create");
      await expect(f.worker.run(new Date("invalid"), f.periodEnd)).rejects.toThrow(
        "Invalid reconciliation period",
      );
      await expect(f.worker.run(f.periodEnd, f.periodStart)).rejects.toThrow(
        "Invalid reconciliation period",
      );
      await expect(f.worker.run(f.periodStart, f.periodStart)).rejects.toThrow(
        "Invalid reconciliation period",
      );
      expect(create).not.toHaveBeenCalled();
      expect(f.verify).not.toHaveBeenCalled();
    });

    it("fails the run on item persistence failure instead of manufacturing a provider exception", async () => {
      const f = await fixture();
      await f.attempt();
      vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
        new Error("synthetic database failure"),
      );
      await expect(f.run()).rejects.toThrow("synthetic database failure");
      const run = await prisma.paymentReconciliationRun.findFirstOrThrow({
        where: {
          provider: "PAYSTACK",
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
        },
        orderBy: { attemptNumber: "desc" },
      });
      expect(run).toMatchObject({
        status: "FAILED",
        failureMessage: "Reconciliation did not complete",
      });
      expect(await f.items(run.id)).toEqual([]);
      expect(f.verify).toHaveBeenCalledTimes(1);
    });

    it("marks a failed final summary write as failed instead of leaving the run running", async () => {
      const f = await fixture();
      vi.spyOn(prisma.paymentReconciliationRun, "update").mockRejectedValueOnce(
        new Error("synthetic summary failure"),
      );
      await expect(f.run()).rejects.toThrow("synthetic summary failure");
      expect(
        await prisma.paymentReconciliationRun.findFirstOrThrow({
          where: {
            provider: "PAYSTACK",
            periodStart: f.periodStart,
            periodEnd: f.periodEnd,
          },
          orderBy: { attemptNumber: "desc" },
        }),
      ).toMatchObject({ status: "FAILED" });
    });

    it("retains a partial failed observation and records a separate same-period retry", async () => {
      const f = await fixture();
      const firstAttempt = await f.attempt();
      await f.attempt({ initiatedAt: new Date(f.periodStart.getTime() + 1) });
      f.verify
        .mockResolvedValueOnce({
          reference: firstAttempt.internalReference,
          gatewayTransactionId: `synthetic-${firstAttempt.internalReference}`,
          status: "pending",
          amountKobo: 10000n,
          currency: "NGN",
          paidAt: null,
          providerFeeKobo: null,
          method: null,
        })
        .mockRejectedValueOnce(new Error("synthetic provider interruption"));
      await expect(f.run()).rejects.toThrow("Provider verification unavailable");

      const first = await prisma.paymentReconciliationRun.findFirstOrThrow({
        where: {
          provider: "PAYSTACK",
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
        },
      });
      expect(first).toMatchObject({ status: "FAILED", attemptNumber: 1 });
      expect(await f.items(first.id)).toHaveLength(1);
      const unobserved = await prisma.paymentReconciliationDue.findUniqueOrThrow({
        where: { paymentAttemptId: firstAttempt.id },
      });
      expect(unobserved).toMatchObject({
        nextDueAt: firstAttempt.initiatedAt,
        latestItemId: null,
      });

      const recovered = await f.run();
      expect(recovered).toMatchObject({
        status: "MATCHED",
        attemptNumber: 2,
        matchedCount: 2,
      });
      expect(await f.items(first.id)).toHaveLength(1);
      expect(await f.items(recovered.id)).toHaveLength(2);
      expect((await f.run()).id).toBe(recovered.id);
      expect(f.verify).toHaveBeenCalledTimes(4);
    });

    it("finds older uncovered attempts after a restart without advancing past a failed period", async () => {
      const f = await fixture();
      const intervalMs = 60_000;
      await f.attempt({ provider: "MONNIFY" });
      await f.attempt({
        provider: "MONNIFY",
        initiatedAt: new Date(f.periodStart.getTime() + intervalMs + 1),
      });
      const now = new Date(f.periodStart.getTime() + intervalMs * 4);
      const first = await f.worker.runNextDueForProvider("MONNIFY", intervalMs, now);
      expect(first).toMatchObject({ status: "MATCHED", matchedCount: 1 });
      const second = await new PaymentReconciliationWorker(
        prisma,
        new PaymentProviderRegistry({
          MONNIFY: {
            verify: f.verify,
            async initialize(): Promise<never> {
              throw new Error("No checkout allowed");
            },
            async refund(): Promise<never> {
              throw new Error("No refund allowed");
            },
          },
        }),
      ).runNextDueForProvider("MONNIFY", intervalMs, now);
      expect(second).toMatchObject({ status: "MATCHED", matchedCount: 1 });
      expect(second?.periodStart).toEqual(
        new Date(f.periodStart.getTime() + intervalMs + 1),
      );
      expect(await f.worker.runNextDueForProvider("MONNIFY", intervalMs, now)).toBeNull();
      expect(f.verify).toHaveBeenCalledTimes(2);
    });

    it("retries the exact failed period before scheduling a replacement window", async () => {
      const f = await fixture();
      await f.attempt({ provider: "MONNIFY" });
      const create = vi
        .spyOn(prisma, "$transaction")
        .mockRejectedValueOnce(new Error("synthetic storage interruption"));
      await expect(f.worker.run(f.periodStart, f.periodEnd, "MONNIFY")).rejects.toThrow(
        "synthetic storage interruption",
      );
      create.mockRestore();
      const recovered = await f.worker.runNextDueForProvider(
        "MONNIFY",
        60_000,
        new Date(f.periodStart.getTime() + 120_000),
      );
      expect(recovered).toMatchObject({
        status: "MATCHED",
        attemptNumber: 2,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      });
    });

    it("records a new snapshot when a late-created attempt falls inside an already completed period", async () => {
      const f = await fixture();
      await f.attempt({ provider: "MONNIFY" });
      const first = await f.worker.run(f.periodStart, f.periodEnd, "MONNIFY");
      expect(first).toMatchObject({ status: "MATCHED", attemptNumber: 1 });
      await f.attempt({
        provider: "MONNIFY",
        initiatedAt: new Date(f.periodStart.getTime() + 1),
      });
      const second = await f.worker.runNextDueForProvider(
        "MONNIFY",
        60_000,
        new Date(f.periodStart.getTime() + 120_000),
      );
      expect(second).toMatchObject({
        status: "MATCHED",
        attemptNumber: 2,
        matchedCount: 2,
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
      });
      expect(await f.items(first.id)).toHaveLength(1);
      expect(await f.items(second!.id)).toHaveLength(2);
    });

    it("recovers an expired running lease while preserving its earlier observation", async () => {
      const f = await fixture();
      const attempt = await f.attempt({ provider: "MONNIFY" });
      const abandoned = await prisma.paymentReconciliationRun.create({
        data: {
          provider: "MONNIFY",
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
          leaseToken: randomUUID(),
          leaseUntil: new Date(Date.now() - 1_000),
        },
      });
      await prisma.paymentReconciliationItem.create({
        data: {
          runId: abandoned.id,
          paymentAttemptId: attempt.id,
          status: "MATCHED",
          providerReference: attempt.providerReference,
          internalAmountKobo: 0n,
          providerAmountKobo: 0n,
        },
      });
      const recovered = await f.worker.runNextDueForProvider(
        "MONNIFY",
        60_000,
        new Date(f.periodStart.getTime() + 120_000),
      );
      expect(recovered).toMatchObject({ status: "MATCHED", attemptNumber: 2 });
      expect(await f.items(abandoned.id)).toHaveLength(1);
      expect(
        await prisma.paymentReconciliationRun.findUniqueOrThrow({
          where: { id: abandoned.id },
        }),
      ).toMatchObject({ status: "FAILED", leaseToken: null, leaseUntil: null });
    });

    it("holds run ownership until the observation insert commits", async () => {
      const f = await fixture();
      await f.attempt();
      const settings = {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.TEST_DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: false,
      };
      const blocker = new PgClient(settings);
      const observer = new PgClient(settings);
      await Promise.all([blocker.connect(), observer.connect()]);
      let runOutcome:
        | Promise<{ value: Awaited<ReturnType<typeof f.run>> | null; error: unknown }>
        | undefined;
      try {
        await blocker.query("BEGIN");
        await blocker.query('LOCK TABLE "PaymentReconciliationItem" IN SHARE MODE');
        runOutcome = f.run().then(
          (value) => ({ value, error: null }),
          (error: unknown) => ({ value: null, error }),
        );
        let waitingForInsert = false;
        for (let tries = 0; tries < 200; tries++) {
          const result = await observer.query<{ waiting: number }>(
            `SELECT count(*)::int AS waiting FROM pg_locks
             WHERE relation = '"PaymentReconciliationItem"'::regclass
               AND NOT granted`,
          );
          if ((result.rows[0]?.waiting ?? 0) > 0) {
            waitingForInsert = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        expect(waitingForInsert).toBe(true);
        const run = await prisma.paymentReconciliationRun.findFirstOrThrow({
          where: {
            provider: "PAYSTACK",
            periodStart: f.periodStart,
            periodEnd: f.periodEnd,
          },
        });
        await expect(
          observer.query(
            'SELECT "id" FROM "PaymentReconciliationRun" WHERE "id" = $1 FOR UPDATE NOWAIT',
            [run.id],
          ),
        ).rejects.toMatchObject({ code: "55P03" });
      } finally {
        await blocker.query("ROLLBACK");
        await Promise.all([blocker.end(), observer.end()]);
      }
      const outcome = await runOutcome;
      expect(outcome?.error).toBeNull();
      expect(outcome?.value).toMatchObject({ status: "MATCHED", matchedCount: 1 });
    }, 30_000);

    it("prevents a replaced worker from persisting after its lease is lost", async () => {
      const f = await fixture();
      const attempt = await f.attempt();
      let signalStarted!: () => void;
      let releaseFirst!: () => void;
      const started = new Promise<void>((resolve) => {
        signalStarted = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      f.verify.mockImplementationOnce(async () => {
        signalStarted();
        await gate;
        return {
          reference: attempt.internalReference,
          gatewayTransactionId: `synthetic-${attempt.internalReference}`,
          status: "pending",
          amountKobo: 10000n,
          currency: "NGN",
          paidAt: null,
          providerFeeKobo: null,
          method: null,
        };
      });
      const firstResult = f.run().catch((error: unknown) => error);
      await started;
      const abandoned = await prisma.paymentReconciliationRun.findFirstOrThrow({
        where: {
          provider: "PAYSTACK",
          periodStart: f.periodStart,
          periodEnd: f.periodEnd,
        },
      });
      await prisma.paymentReconciliationRun.update({
        where: { id: abandoned.id },
        data: { leaseUntil: new Date(Date.now() - 1_000) },
      });
      const replacement = await f.run();
      releaseFirst();
      expect(await firstResult).toBeInstanceOf(Error);
      expect(replacement).toMatchObject({ status: "MATCHED", attemptNumber: 2 });
      expect(await f.items(abandoned.id)).toEqual([]);
      expect(await f.items(replacement.id)).toHaveLength(1);
    });

    it("rechecks a pending observation, then a discrepancy, and stops after a terminal match", async () => {
      const f = await fixture();
      const periodStart = new Date("1900-01-01T00:00:00.000Z");
      const periodEnd = new Date(periodStart.getTime() + 1_000);
      const attempt = await f.attempt({ provider: "MONNIFY", initiatedAt: periodStart });
      const initial = await f.worker.run(periodStart, periodEnd, "MONNIFY");
      expect(initial).toMatchObject({ status: "MATCHED", attemptNumber: 1 });
      const intervalMs = 60_000;
      const countSnapshots = () =>
        prisma.paymentReconciliationRun.count({
          where: { provider: "MONNIFY", periodStart, periodEnd },
        });
      await f.worker.runNextDueForProvider(
        "MONNIFY",
        intervalMs,
        new Date(initial.completedAt!.getTime() + intervalMs / 2),
      );
      expect(await countSnapshots()).toBe(1);

      f.verify.mockResolvedValueOnce({
        reference: attempt.internalReference,
        gatewayTransactionId: `synthetic-${attempt.internalReference}`,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt: new Date(),
        providerFeeKobo: null,
        method: null,
      });
      const discrepancy = await f.worker.runNextDueForProvider(
        "MONNIFY",
        intervalMs,
        new Date(initial.completedAt!.getTime() + intervalMs + 1_000),
      );
      expect(discrepancy).toMatchObject({
        status: "DIFFERENCES_FOUND",
        attemptNumber: 2,
        differenceCount: 1,
      });

      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", failedAt: new Date() },
      });
      f.verify.mockResolvedValueOnce({
        reference: attempt.internalReference,
        gatewayTransactionId: `synthetic-${attempt.internalReference}`,
        status: "failed",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt: null,
        providerFeeKobo: null,
        method: null,
      });
      const settled = await f.worker.runNextDueForProvider(
        "MONNIFY",
        intervalMs,
        new Date(discrepancy!.completedAt!.getTime() + intervalMs + 1_000),
      );
      expect(settled).toMatchObject({
        status: "MATCHED",
        attemptNumber: 3,
        matchedCount: 1,
      });
      await f.worker.runNextDueForProvider(
        "MONNIFY",
        intervalMs,
        new Date(settled!.completedAt!.getTime() + intervalMs + 1_000),
      );
      expect(await countSnapshots()).toBe(3);
    });

    it("queues a changed terminal attempt until its new state has been observed", async () => {
      const f = await fixture();
      const attempt = await f.attempt({ provider: "MONNIFY" });
      const inserted = await prisma.paymentReconciliationDue.findUniqueOrThrow({
        where: { paymentAttemptId: attempt.id },
      });
      expect(inserted.nextDueAt).toEqual(attempt.initiatedAt);
      expect(inserted.latestItemId).toBeNull();

      const first = await f.worker.run(f.periodStart, f.periodEnd, "MONNIFY");
      const pending = await prisma.paymentReconciliationDue.findUniqueOrThrow({
        where: { paymentAttemptId: attempt.id },
      });
      expect(pending).toMatchObject({
        latestItemStatus: "MATCHED",
        nextDueAt: first.completedAt,
      });

      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "FAILED", failedAt: new Date() },
      });
      const changed = await prisma.paymentReconciliationDue.findUniqueOrThrow({
        where: { paymentAttemptId: attempt.id },
      });
      expect(changed.nextDueAt).toEqual(first.completedAt);
      f.verify.mockResolvedValueOnce({
        reference: attempt.internalReference,
        gatewayTransactionId: `synthetic-${attempt.internalReference}`,
        status: "failed",
        amountKobo: 10000n,
        currency: "NGN",
        paidAt: null,
        providerFeeKobo: null,
        method: null,
      });
      const settled = await f.worker.run(f.periodStart, f.periodEnd, "MONNIFY", true);
      expect(settled).toMatchObject({ status: "MATCHED", attemptNumber: 2 });
      const terminal = await prisma.paymentReconciliationDue.findUniqueOrThrow({
        where: { paymentAttemptId: attempt.id },
      });
      expect(terminal).toMatchObject({ latestItemStatus: "MATCHED", nextDueAt: null });

      await prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: "PENDING", failedAt: null },
      });
      const reopened = await prisma.paymentReconciliationDue.findUniqueOrThrow({
        where: { paymentAttemptId: attempt.id },
      });
      expect(reopened.nextDueAt).toEqual(settled!.completedAt);
    });

    it("backfills unseen, recurring and terminal attempts from existing immutable observations", async () => {
      const connection = new PgClient({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.TEST_DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: false,
      });
      const schema = `aat_due_backfill_${randomUUID().replaceAll("-", "")}`;
      const ids = Array.from({ length: 4 }, () => randomUUID());
      const runId = randomUUID();
      const failedRunId = randomUUID();
      const completedAt = new Date("2026-01-02T00:00:00.000Z");
      const initiatedAt = new Date("2026-01-01T00:00:00.000Z");
      await connection.connect();
      try {
        await connection.query("BEGIN");
        await connection.query(`CREATE SCHEMA "${schema}"`);
        await connection.query(`SET LOCAL search_path TO "${schema}"`);
        await connection.query(
          `CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'MONNIFY', 'MANUAL');
           CREATE TYPE "ReconciliationItemStatus" AS ENUM ('MATCHED', 'STATUS_MISMATCH');
           CREATE TABLE "PaymentAttempt" (
             "id" UUID PRIMARY KEY, "provider" "PaymentProvider" NOT NULL,
             "initiatedAt" TIMESTAMP(3) NOT NULL, "status" TEXT NOT NULL
           );
           CREATE TABLE "PaymentReconciliationRun" (
             "id" UUID PRIMARY KEY, "status" TEXT NOT NULL,
             "completedAt" TIMESTAMP(3), "startedAt" TIMESTAMP(3) NOT NULL,
             "attemptNumber" INTEGER NOT NULL
           );
           CREATE TABLE "PaymentReconciliationItem" (
             "id" UUID PRIMARY KEY, "runId" UUID NOT NULL,
             "paymentAttemptId" UUID NOT NULL,
             "status" "ReconciliationItemStatus" NOT NULL,
             "createdAt" TIMESTAMP(3) NOT NULL
           );`,
        );
        for (const [index, id] of ids.entries()) {
          await connection.query(
            `INSERT INTO "PaymentAttempt" VALUES ($1, 'PAYSTACK', $2, $3)`,
            [id, initiatedAt, index === 0 ? "SUCCESSFUL" : "PENDING"],
          );
        }
        await connection.query(
          `INSERT INTO "PaymentReconciliationRun" VALUES
            ($1, 'DIFFERENCES_FOUND', $3, $4, 1),
            ($2, 'FAILED', $3, $4, 1)`,
          [runId, failedRunId, completedAt, initiatedAt],
        );
        await connection.query(
          `INSERT INTO "PaymentReconciliationItem" VALUES
            ($1, $2, $3, 'MATCHED', $4),
            ($5, $2, $6, 'MATCHED', $4),
            ($7, $2, $8, 'STATUS_MISMATCH', $4),
            ($9, $10, $11, 'MATCHED', $4)`,
          [
            randomUUID(),
            runId,
            ids[0],
            completedAt,
            randomUUID(),
            ids[1],
            randomUUID(),
            ids[3],
            randomUUID(),
            failedRunId,
            ids[2],
          ],
        );
        const migration = await readFile(
          new URL(
            "../../prisma/migrations/20261027010000_reconciliation_due_projection/migration.sql",
            import.meta.url,
          ),
          "utf8",
        );
        await connection.query(migration);
        const rows = await connection.query<{
          paymentAttemptId: string;
          nextDueAt: Date | null;
          latestItemStatus: string | null;
        }>(
          `SELECT "paymentAttemptId", "nextDueAt", "latestItemStatus"
           FROM "PaymentReconciliationDue"`,
        );
        const byId = new Map(rows.rows.map((row) => [row.paymentAttemptId, row]));
        expect(byId.size).toBe(4);
        expect(byId.get(ids[0]!)?.nextDueAt).toBeNull();
        expect(byId.get(ids[0]!)?.latestItemStatus).toBe("MATCHED");
        expect(byId.get(ids[1]!)?.nextDueAt).toEqual(completedAt);
        expect(byId.get(ids[2]!)?.nextDueAt).toEqual(initiatedAt);
        expect(byId.get(ids[2]!)?.latestItemStatus).toBeNull();
        expect(byId.get(ids[3]!)?.nextDueAt).toEqual(completedAt);
        expect(byId.get(ids[3]!)?.latestItemStatus).toBe("STATUS_MISMATCH");

        // A status change after that completed snapshot must re-enter the queue.
        await connection.query(
          `UPDATE "PaymentAttempt" SET "status" = 'PENDING' WHERE "id" = $1`,
          [ids[0]],
        );
        const reopened = await connection.query<{ nextDueAt: Date | null }>(
          `SELECT "nextDueAt" FROM "PaymentReconciliationDue"
           WHERE "paymentAttemptId" = $1`,
          [ids[0]],
        );
        expect(reopened.rows[0]?.nextDueAt).toEqual(completedAt);
      } finally {
        await connection.query("ROLLBACK");
        await connection.end();
      }
    });
  },
);
