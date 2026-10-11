import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../src/config/database.js";
import { PaymentsService } from "../../src/modules/payments/payments.service.js";
import { AuditOperationsService } from "../../src/modules/audit/audit.service.js";
import { PaymentWebhookRetryWorker } from "../../src/workers/webhook-retry.worker.js";
import type { PaystackWebhookEvent } from "../../src/providers/payments/paystack-webhook.js";
import { providerUnavailable } from "../../src/common/errors/provider-error-mapper.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const context = { requestId: "webhook-claim-test", ipAddress: null, userAgent: null };
function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Webhook claim ownership",
  () => {
    const ids: string[] = [];
    afterEach(async () => {
      vi.restoreAllMocks();
      await prisma.paymentWebhookEvent.updateMany({
        where: { id: { in: ids }, status: { not: "PROCESSED" } },
        data: { status: "DEAD_LETTER", failedAt: new Date(), lockedAt: null },
      });
      ids.length = 0;
    });
    afterAll(() => prisma.$disconnect());
    const snapshot = (id: string) =>
      prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { id } });
    async function fixture(attempts = 0, provider: "PAYSTACK" | "MONNIFY" = "PAYSTACK") {
      const payloadSha256 = digest(randomUUID());
      const event: PaystackWebhookEvent = {
        eventType: "charge.success",
        providerEventId: randomUUID(),
        resourceId: null,
        reference: `missing-${randomUUID()}`,
        status: "success",
        amountKobo: 10000n,
        currency: "NGN",
        gatewayTransactionId: randomUUID(),
        paidAt: null,
        providerFeeKobo: null,
        method: null,
        category: null,
        responseDueAt: null,
      };
      const row = await prisma.paymentWebhookEvent.create({
        data: {
          provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payloadSha256,
          deduplicationKey: digest(
            `${event.eventType}:${event.providerEventId}:${payloadSha256}`,
          ),
          signatureVerifiedAt: new Date(),
          processingAttempts: attempts,
          receivedAt: new Date(0),
          redactedPayload: {
            ...event,
            amountKobo: "10000",
            paidAt: null,
            providerFeeKobo: null,
            responseDueAt: null,
          },
        },
      });
      ids.push(row.id);
      return { row, event, payloadSha256 };
    }

    for (const provider of ["PAYSTACK", "MONNIFY"] as const) {
      it.each(["RECEIVED", "PROCESSING", "FAILED", "DEAD_LETTER"] as const)(
        `${provider} redelivery preserves %s ownership and retry decisions`,
        async (status) => {
          const f = await fixture(3, provider);
          await prisma.paymentWebhookEvent.update({
            where: { id: f.row.id },
            data: {
              status,
              lockedAt: status === "PROCESSING" ? new Date() : null,
              failedAt: ["FAILED", "DEAD_LETTER"].includes(status) ? new Date() : null,
              nextAttemptAt: new Date(Date.now() + 60000),
            },
          });
          const before = await snapshot(f.row.id);
          const service = new PaymentsService(prisma);
          const result =
            provider === "PAYSTACK"
              ? await service.ingestWebhook(f.event, digest(randomUUID()), context)
              : await service.ingestMonnifyWebhook(
                  {
                    kind: "transaction",
                    eventType: "SUCCESSFUL_TRANSACTION",
                    providerEventId: f.event.providerEventId!,
                    reference: f.event.reference!,
                    gatewayTransactionId: f.event.gatewayTransactionId!,
                    status: "PAID",
                    amountKobo: 10000n,
                    currency: "NGN",
                    paidAt: null,
                    providerFeeKobo: null,
                    method: null,
                  },
                  digest(randomUUID()),
                  true,
                  context,
                );
          expect(result).toMatchObject({ accepted: true, duplicate: true });
          expect(await snapshot(f.row.id)).toEqual(before);
        },
      );
    }

    it.each(["success", "failure"] as const)(
      "a stale %s preserves a newer in-flight claim",
      async (outcome) => {
        const f = await fixture();
        const oldStarted = gate(),
          oldFinish = gate(),
          newStarted = gate(),
          newFinish = gate();
        const oldService = new PaymentsService(prisma),
          newService = new PaymentsService(prisma);
        const oldIngest = oldService.ingestWebhook.bind(oldService),
          newIngest = newService.ingestWebhook.bind(newService);
        vi.spyOn(oldService, "ingestWebhook").mockImplementation(async (...args) => {
          oldStarted.release();
          await oldFinish.promise;
          if (outcome === "failure") throw providerUnavailable();
          return oldIngest(...args);
        });
        vi.spyOn(newService, "ingestWebhook").mockImplementation(async (...args) => {
          newStarted.release();
          await newFinish.promise;
          return newIngest(...args);
        });
        const oldRun = new PaymentWebhookRetryWorker(prisma, oldService).runOnce(1);
        let newRun: Promise<number> | undefined;
        try {
          await oldStarted.promise;
          await prisma.paymentWebhookEvent.update({
            where: { id: f.row.id },
            data: { lockedAt: new Date(0) },
          });
          newRun = new PaymentWebhookRetryWorker(prisma, newService).runOnce(1);
          await newStarted.promise;
          const owned = await snapshot(f.row.id);
          expect(owned).toMatchObject({ status: "PROCESSING", processingAttempts: 2 });
          oldFinish.release();
          await oldRun;
          expect(await snapshot(f.row.id)).toEqual(owned);
          newFinish.release();
          await newRun;
          expect(await snapshot(f.row.id)).toMatchObject({
            status: "FAILED",
            processingAttempts: 2,
            lastErrorCode: "UNKNOWN_PAYMENT_REFERENCE",
          });
        } finally {
          oldFinish.release();
          newFinish.release();
          await Promise.allSettled([oldRun, ...(newRun ? [newRun] : [])]);
        }
      },
    );

    it("skips superseded entries still waiting in an old batch", async () => {
      const first = await fixture(),
        second = await fixture();
      const started = gate(),
        finish = gate();
      const service = new PaymentsService(prisma);
      const ingest = service.ingestWebhook.bind(service);
      const calls = vi
        .spyOn(service, "ingestWebhook")
        .mockImplementation(async (...args) => {
          started.release();
          await finish.promise;
          return ingest(...args);
        });
      const oldRun = new PaymentWebhookRetryWorker(prisma, service).runOnce(2);
      try {
        await started.promise;
        await prisma.paymentWebhookEvent.updateMany({
          where: { id: { in: [first.row.id, second.row.id] } },
          data: { lockedAt: new Date(0) },
        });
        await new PaymentWebhookRetryWorker(prisma, new PaymentsService(prisma)).runOnce(
          2,
        );
        const completed = await Promise.all([
          snapshot(first.row.id),
          snapshot(second.row.id),
        ]);
        finish.release();
        await oldRun;
        expect(calls).toHaveBeenCalledTimes(1);
        expect(
          await Promise.all([snapshot(first.row.id), snapshot(second.row.id)]),
        ).toEqual(completed);
      } finally {
        finish.release();
        await oldRun;
      }
    });

    it("does not dead-letter another worker's fresh final attempt", async () => {
      const f = await fixture(7);
      const started = gate(),
        finish = gate();
      const service = new PaymentsService(prisma);
      vi.spyOn(service, "ingestWebhook").mockImplementation(async () => {
        started.release();
        await finish.promise;
        throw providerUnavailable();
      });
      const run = new PaymentWebhookRetryWorker(prisma, service).runOnce(1);
      try {
        await started.promise;
        const owned = await snapshot(f.row.id);
        expect(owned).toMatchObject({ status: "PROCESSING", processingAttempts: 8 });
        await new PaymentWebhookRetryWorker(prisma, new PaymentsService(prisma)).runOnce(
          1,
        );
        expect(await snapshot(f.row.id)).toEqual(owned);
        finish.release();
        await run;
        expect(await snapshot(f.row.id)).toMatchObject({
          status: "DEAD_LETTER",
          processingAttempts: 8,
          lockedAt: null,
        });
      } finally {
        finish.release();
        await run;
      }
    });

    it("recovers an expired final lease with valid dead-letter timestamps", async () => {
      const f = await fixture(8);
      await prisma.paymentWebhookEvent.update({
        where: { id: f.row.id },
        data: { status: "PROCESSING", lockedAt: new Date(0) },
      });
      await new PaymentWebhookRetryWorker(prisma, new PaymentsService(prisma)).runOnce(1);
      expect(await snapshot(f.row.id)).toMatchObject({
        status: "DEAD_LETTER",
        processingAttempts: 8,
        failedAt: expect.any(Date),
        lockedAt: null,
      });
    });

    it("an audited manual retry permits one attempt beyond the automatic retry budget", async () => {
      const f = await fixture(8);
      await prisma.paymentWebhookEvent.update({
        where: { id: f.row.id },
        data: { status: "DEAD_LETTER", failedAt: new Date() },
      });
      const user = await prisma.user.create({
        data: {
          email: `webhook-admin-${randomUUID()}@example.test`,
          passwordHash: "unusable",
          role: "ADMIN",
        },
      });
      await new AuditOperationsService(prisma).retryJob(
        {
          userId: user.id,
          email: user.email,
          role: "ADMIN",
          sessionId: randomUUID(),
          mfaRequired: true,
          mfaVerifiedAt: new Date(),
        },
        "webhook",
        f.row.id,
        { expectedAttempts: 8 },
        context,
      );
      const service = new PaymentsService(prisma);
      const calls = vi
        .spyOn(service, "ingestWebhook")
        .mockRejectedValue(providerUnavailable());
      await new PaymentWebhookRetryWorker(prisma, service).runOnce(1);
      expect(calls).toHaveBeenCalledTimes(1);
      expect(await snapshot(f.row.id)).toMatchObject({
        status: "DEAD_LETTER",
        processingAttempts: 9,
      });
      await new PaymentWebhookRetryWorker(prisma, service).runOnce(1);
      // Other suites may leave retryable events in this database. Count dispatches
      // of this receipt, not unrelated queue work performed by the second run.
      expect(calls.mock.calls.filter((call) => call[3]?.id === f.row.id)).toHaveLength(1);
      expect(await snapshot(f.row.id)).toMatchObject({
        status: "DEAD_LETTER",
        processingAttempts: 9,
      });
    });
  },
);
