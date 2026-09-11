import { z } from "zod";
import { AppError } from "../common/errors/app-error.js";
import { prisma } from "../config/database.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  paymentsService,
  type PaymentsService,
} from "../modules/payments/payments.service.js";
import type { PaystackWebhookEvent } from "../providers/payments/paystack-webhook.js";

const redactedSchema = z.object({
  eventType: z.string(),
  providerEventId: z.string().nullable(),
  resourceId: z.string().nullable(),
  reference: z.string().nullable(),
  status: z.string().nullable(),
  amountKobo: z.string().regex(/^\d+$/).nullable(),
  currency: z.string().nullable(),
  gatewayTransactionId: z.string().nullable(),
  paidAt: z.string().nullable(),
  providerFeeKobo: z.string().regex(/^\d+$/).nullable(),
  method: z.string().nullable(),
  category: z.string().nullable(),
  responseDueAt: z.string().nullable(),
});
export class PaymentWebhookRetryWorker {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly service: PaymentsService = paymentsService,
  ) {}
  async runOnce(batchSize = 25) {
    const limit = Math.max(1, Math.min(batchSize, 100));
    const claimed = await this.database.$transaction(
      async (tx) => tx.$queryRaw<
        Array<{
          id: string;
          provider: "PAYSTACK" | "MONNIFY" | "MANUAL";
          payloadSha256: string;
          redactedPayload: unknown;
          processingAttempts: number;
        }>
      >`
      UPDATE "PaymentWebhookEvent" SET "status" = 'PROCESSING', "lockedAt" = CURRENT_TIMESTAMP, "processingAttempts" = "processingAttempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "PaymentWebhookEvent"
        WHERE "status" IN ('RECEIVED', 'FAILED') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= CURRENT_TIMESTAMP)
        ORDER BY "receivedAt" ASC FOR UPDATE SKIP LOCKED LIMIT ${limit}
      )
      RETURNING "id", "provider", "payloadSha256", "redactedPayload", "processingAttempts"`,
    );
    for (const item of claimed) {
      try {
        if (item.provider === "MONNIFY") {
          await this.service.retryMonnifyWebhook(item.id, {
            requestId: `webhook-retry:${item.id}`,
            ipAddress: null,
            userAgent: null,
          });
          continue;
        }
        if (item.provider !== "PAYSTACK") throw new Error("Unsupported webhook provider");
        const value = redactedSchema.parse(item.redactedPayload);
        const event: PaystackWebhookEvent = {
          ...value,
          amountKobo: value.amountKobo === null ? null : BigInt(value.amountKobo),
          paidAt: value.paidAt ? new Date(value.paidAt) : null,
          providerFeeKobo:
            value.providerFeeKobo === null ? null : BigInt(value.providerFeeKobo),
          responseDueAt: value.responseDueAt ? new Date(value.responseDueAt) : null,
        };
        await this.service.ingestWebhook(event, item.payloadSha256, {
          requestId: `webhook-retry:${item.id}`,
          ipAddress: null,
          userAgent: null,
        });
      } catch (error: unknown) {
        const terminal =
          item.processingAttempts >= 8 ||
          error instanceof z.ZodError ||
          (error instanceof AppError && !error.retryable);
        const delaySeconds = Math.min(
          3_600,
          2 ** Math.min(item.processingAttempts, 8) * 15,
        );
        await this.database.paymentWebhookEvent.updateMany({
          where: { id: item.id, status: "PROCESSING" },
          data: {
            status: terminal ? "DEAD_LETTER" : "FAILED",
            failedAt: new Date(),
            lockedAt: null,
            nextAttemptAt: terminal ? null : new Date(Date.now() + delaySeconds * 1_000),
            lastErrorCode: "WEBHOOK_RETRY_FAILED",
            lastErrorMessage: "Allowlisted webhook processing failed",
          },
        });
      }
    }
    return claimed.length;
  }
}
