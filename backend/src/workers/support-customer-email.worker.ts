import { prisma } from "../config/database.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { AppError } from "../common/errors/app-error.js";
import {
  decryptNotificationPayload,
  type EncryptedEnvelope,
} from "../common/security/mfa-encryption.js";
import { isStagingRecipientAllowed } from "../common/security/messaging-recipients.js";
import {
  supportCustomerEmailEvent,
  supportEmailPayloadSchema,
} from "../modules/support/customer-email.js";
import { renderSupportCustomerEmail } from "../modules/support/customer-email.js";
import type { EmailProvider } from "../providers/messaging/email-provider.port.js";
import { renewMessagingClaim } from "./messaging-claim.js";

interface ClaimedEmail {
  id: string;
  eventId: string;
  attempts: number;
  payload: unknown;
}

export class SupportCustomerEmailWorker {
  constructor(
    private readonly email: EmailProvider | null,
    private readonly database: PrismaClient = prisma,
  ) {}

  async runOnce(batchSize = 25): Promise<number> {
    if (!this.email) return 0;
    const limit = Math.max(1, Math.min(batchSize, 100));
    const events = await this.database.$queryRaw<ClaimedEmail[]>`
      WITH candidates AS (
        SELECT "id" FROM "OutboxEvent"
        WHERE "eventType" = ${supportCustomerEmailEvent} AND (
          ("status" IN ('PENDING', 'FAILED') AND "availableAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'))
          OR ("status" = 'PROCESSING' AND "lockedAt" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '10 minutes')
        ) ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT ${limit}
      ) UPDATE "OutboxEvent" AS event SET "status" = 'PROCESSING',
        "lockedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), "attempts" = event."attempts" + 1,
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FROM candidates WHERE event."id" = candidates."id"
      RETURNING event."id", event."eventId", event."payload", event."attempts"
    `;
    for (const event of events) await this.deliver(event);
    return events.length;
  }

  private async deliver(event: ClaimedEmail): Promise<void> {
    if (!(await renewMessagingClaim(this.database, event))) return;
    let terminal = event.attempts >= 8;
    let code = "SUPPORT_EMAIL_FAILED";
    const where = {
      id: event.id,
      status: "PROCESSING" as const,
      attempts: event.attempts,
    };
    try {
      // Fail closed on malformed/decryption-incompatible payloads.
      terminal = true;
      const payload = supportEmailPayloadSchema.parse(
        decryptNotificationPayload(
          (event.payload as { encrypted: EncryptedEnvelope }).encrypted,
        ),
      );
      if (!payload.recipient || !payload.replyTo) {
        code = !payload.recipient ? "NO_RECIPIENT" : "SUPPORT_REPLY_ADDRESS_MISSING";
        throw new Error("Missing support email destination");
      }
      if (payload.userId) {
        const preference = await this.database.notificationPreference.findUnique({
          where: {
            userId_category_channel: {
              userId: payload.userId,
              category: "OPERATIONAL",
              channel: "EMAIL",
            },
          },
          select: { enabled: true },
        });
        if (preference?.enabled === false) {
          code = "CONSENT_WITHDRAWN";
          throw new Error("Operational email disabled by recipient");
        }
      }
      if (!isStagingRecipientAllowed("EMAIL", payload.recipient)) {
        code = "STAGING_RECIPIENT_NOT_ALLOWLISTED";
        throw new Error("Support recipient is not allowlisted");
      }
      terminal = event.attempts >= 8;
      await this.email!.send({
        to: payload.recipient,
        replyTo: payload.replyTo,
        ...renderSupportCustomerEmail(payload),
        idempotencyKey: event.eventId,
      });
      await this.database.outboxEvent.updateMany({
        where,
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
    } catch (error: unknown) {
      if (error instanceof AppError && !error.retryable) {
        terminal = true;
        if (code === "SUPPORT_EMAIL_FAILED") code = "PROVIDER_REJECTED";
      } else if (terminal && code === "SUPPORT_EMAIL_FAILED") {
        code = "RETRY_EXHAUSTED";
      }
      await this.database.outboxEvent.updateMany({
        where,
        data: {
          status: terminal ? "DEAD_LETTER" : "FAILED",
          lockedAt: null,
          lastError: code,
          availableAt: new Date(
            Date.now() + Math.min(3_600, 2 ** Math.min(event.attempts, 8) * 15) * 1_000,
          ),
        },
      });
    }
  }
}
