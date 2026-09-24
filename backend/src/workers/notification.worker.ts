import { z } from "zod";
import { AppError } from "../common/errors/app-error.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import {
  decryptNotificationPayload,
  type EncryptedEnvelope,
} from "../common/security/mfa-encryption.js";
import { isStagingRecipientAllowed } from "../common/security/messaging-recipients.js";
import { logger } from "../common/observability/logger.js";
import { renderNotificationEmail } from "../modules/notifications/notification-delivery.templates.js";
import { notificationEventTypes } from "../modules/notifications/notifications.events.js";
import type { NotificationDeliveryPayload } from "../modules/notifications/notifications.types.js";
import type { EmailProvider } from "../providers/messaging/email-provider.port.js";
import type { SmsProvider } from "../providers/messaging/sms-provider.port.js";

const envelopeSchema = z.object({
  version: z.literal(1),
  keyId: z.string().min(1).max(120),
  iv: z.string().min(1).max(128),
  ciphertext: z.string().min(1).max(32_768),
  tag: z.string().min(1).max(128),
});
const payloadSchema = z
  .object({
    channel: z.enum(["EMAIL", "SMS"]),
    recipient: z.string().min(3).max(254),
    title: z.string().min(1).max(160),
    message: z.string().min(1).max(2_000),
    bookingAction: z
      .object({
        url: z.url(),
        bookingId: z.uuid(),
        scheduleVersion: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .strict();

interface ClaimedDelivery {
  id: string;
  eventId: string;
  payload: unknown;
  attempts: number;
  deliveryId: string;
  channel: "EMAIL" | "SMS";
}

export class NotificationDeliveryWorker {
  constructor(
    private readonly email: EmailProvider | null,
    private readonly sms: SmsProvider | null,
    private readonly database: PrismaClient = prisma,
  ) {}

  async runOnce(batchSize = 25): Promise<number> {
    const limit = Math.max(1, Math.min(batchSize, 100));
    const claimed = await this.database.$queryRaw<ClaimedDelivery[]>`
        WITH candidates AS (
          SELECT event."id", delivery."id" AS "deliveryId"
          FROM "OutboxEvent" event
          JOIN "NotificationDelivery" delivery ON delivery."outboxEventId" = event."id"
          WHERE (
            (event."status" IN ('PENDING', 'FAILED') AND event."availableAt" <= CURRENT_TIMESTAMP)
            OR (event."status" = 'PROCESSING' AND event."lockedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
          )
          AND event."eventType" = ${notificationEventTypes.deliveryRequested}
          AND delivery."status" IN ('PENDING', 'FAILED', 'PROCESSING')
          ORDER BY event."createdAt" ASC
          FOR UPDATE OF event SKIP LOCKED
          LIMIT ${limit}
        ), claimed AS (
          UPDATE "OutboxEvent" event
          SET "status" = 'PROCESSING',
              "lockedAt" = CURRENT_TIMESTAMP,
              "attempts" = event."attempts" + 1,
              "updatedAt" = CURRENT_TIMESTAMP
          FROM candidates
          WHERE event."id" = candidates."id"
          RETURNING event."id", event."eventId", event."payload", event."attempts",
                    candidates."deliveryId"
        ), delivery_claims AS (
          UPDATE "NotificationDelivery" delivery
          SET "status" = 'PROCESSING',
              "attempts" = claimed."attempts",
              "lastErrorCode" = NULL,
              "updatedAt" = CURRENT_TIMESTAMP
          FROM claimed
          WHERE delivery."id" = claimed."deliveryId"
          RETURNING delivery."id" AS "deliveryId", delivery."channel",
                    delivery."outboxEventId"
        )
        SELECT claimed."id", claimed."eventId", claimed."payload", claimed."attempts",
               delivery_claims."deliveryId", delivery_claims."channel"
        FROM claimed
        JOIN delivery_claims ON delivery_claims."outboxEventId" = claimed."id"
      `;
    for (const event of claimed) await this.deliver(event);
    return claimed.length;
  }

  private async deliver(event: ClaimedDelivery): Promise<void> {
    let code = "NOTIFICATION_DELIVERY_FAILED";
    let terminal = event.attempts >= 8;
    try {
      const encrypted = envelopeSchema.parse(
        (event.payload as { encrypted?: unknown } | null)?.encrypted,
      ) as EncryptedEnvelope;
      const payload = payloadSchema.parse(
        decryptNotificationPayload<NotificationDeliveryPayload>(encrypted),
      );
      const delivery = await this.database.notificationDelivery.findUnique({
        where: { id: event.deliveryId },
        include: { notification: true },
      });
      if (delivery?.notification.category === "MARKETING") {
        code = "MARKETING_DISABLED";
        terminal = true;
        throw new Error("Marketing execution disabled");
      }
      if (delivery?.notification.category === "OPERATIONAL") {
        const preference = await this.database.notificationPreference.findUnique({
          where: {
            userId_category_channel: {
              userId: delivery.notification.userId,
              category: "OPERATIONAL",
              channel: event.channel,
            },
          },
        });
        if (preference?.enabled === false) {
          code = "CONSENT_WITHDRAWN";
          terminal = true;
          throw new Error("Operational messages disabled by recipient");
        }
      }
      if (payload.bookingAction) {
        const booking = await this.database.booking.findUnique({
          where: { id: payload.bookingAction.bookingId },
          select: { status: true, scheduleVersion: true },
        });
        if (
          !booking ||
          booking.status !== "CONFIRMED" ||
          booking.scheduleVersion !== payload.bookingAction.scheduleVersion
        ) {
          code = "STALE_BOOKING_REMINDER";
          terminal = true;
          throw new Error("Appointment changed before reminder delivery");
        }
      }
      if (payload.channel !== event.channel) throw new Error("Delivery channel mismatch");
      if (!isStagingRecipientAllowed(payload.channel, payload.recipient)) {
        code = "STAGING_RECIPIENT_NOT_ALLOWLISTED";
        terminal = true;
        throw new Error("Staging recipient is not allowlisted");
      }
      if (payload.channel === "EMAIL") {
        if (this.email === null) throw new Error("Email channel is disabled");
        await this.email.send({
          to: payload.recipient,
          ...renderNotificationEmail(payload),
          idempotencyKey: event.eventId,
        });
      } else {
        if (this.sms === null) throw new Error("SMS channel is disabled");
        await this.sms.send({
          to: payload.recipient,
          text: payload.message,
          idempotencyKey: event.eventId,
        });
      }
      const now = new Date();
      await this.database.$transaction([
        this.database.outboxEvent.updateMany({
          where: { id: event.id, status: "PROCESSING" },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            lockedAt: null,
            lastError: null,
          },
        }),
        this.database.notificationDelivery.updateMany({
          where: { id: event.deliveryId, status: "PROCESSING" },
          data: {
            status: "PUBLISHED",
            attempts: event.attempts,
            deliveredAt: now,
            lastErrorCode: null,
          },
        }),
      ]);
    } catch (error: unknown) {
      if (error instanceof AppError && !error.retryable) {
        code = "NOTIFICATION_DELIVERY_REJECTED";
        terminal = true;
      }
      const delaySeconds = Math.min(3_600, 2 ** Math.min(event.attempts, 8) * 15);
      await this.database.$transaction([
        this.database.outboxEvent.updateMany({
          where: { id: event.id, status: "PROCESSING" },
          data: {
            status: terminal ? "DEAD_LETTER" : "FAILED",
            availableAt: new Date(Date.now() + delaySeconds * 1_000),
            lockedAt: null,
            lastError: code,
          },
        }),
        this.database.notificationDelivery.updateMany({
          where: { id: event.deliveryId, status: "PROCESSING" },
          data: {
            status: terminal ? "DEAD_LETTER" : "FAILED",
            attempts: event.attempts,
            lastErrorCode: code,
          },
        }),
      ]);
      logger.warn(
        {
          eventId: event.eventId,
          channel: event.channel,
          attempt: event.attempts,
          terminal,
        },
        "Notification delivery failed",
      );
    }
  }
}
