import webpush from "web-push";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import {
  decryptNotificationPayload,
  type EncryptedEnvelope,
} from "../common/security/mfa-encryption.js";
import { pushConfigured } from "../modules/notifications/push.service.js";
import {
  pushEventSchema,
  pushEventType,
  pushSubscriptionSchema,
} from "../modules/notifications/push.schemas.js";
import { renewMessagingClaim } from "./messaging-claim.js";

type Event = { id: string; attempts: number; payload: unknown; createdAt: Date };
export class PushWorker {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly send = webpush.sendNotification,
  ) {}
  async runOnce(batchSize = 25): Promise<number> {
    if (!pushConfigured()) return 0;
    const limit = Math.max(1, Math.min(batchSize, 100));
    const events = await this.database.$queryRaw<Event[]>`
      WITH candidates AS (
        SELECT "id" FROM "OutboxEvent" WHERE "eventType" = ${pushEventType} AND (
          ("status" IN ('PENDING', 'FAILED') AND "availableAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')) OR
          ("status" = 'PROCESSING' AND "lockedAt" < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') - INTERVAL '10 minutes')
        ) ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT ${limit}
      ) UPDATE "OutboxEvent" AS event SET "status" = 'PROCESSING',
        "lockedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'), "attempts" = event."attempts" + 1,
        "updatedAt" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')
      FROM candidates WHERE event."id" = candidates."id"
      RETURNING event."id", event."attempts", event."payload", event."createdAt"
    `;
    for (const event of events) await this.deliver(event);
    return events.length;
  }
  private async deliver(event: Event) {
    if (!(await renewMessagingClaim(this.database, event))) return;
    const where = {
      id: event.id,
      status: "PROCESSING" as const,
      attempts: event.attempts,
    };
    let terminal = true;
    let code = "PUSH_INELIGIBLE";
    let subscriptionId: string | undefined;
    try {
      const payload = pushEventSchema.parse(event.payload);
      const subscription = await this.database.pushSubscription.findUnique({
        where: { id: payload.subscriptionId },
        include: {
          session: true,
          user: { select: { role: true, status: true, emailVerifiedAt: true } },
        },
      });
      const notification = await this.database.notification.findUnique({
        where: { id: payload.notificationId },
      });
      const now = new Date();
      if (
        !subscription ||
        subscription.disabledAt ||
        !notification ||
        notification.userId !== subscription.userId ||
        notification.readAt ||
        (notification.expiresAt && notification.expiresAt <= now) ||
        event.createdAt < subscription.updatedAt ||
        subscription.session.userId !== subscription.userId ||
        subscription.session.revokedAt ||
        subscription.session.expiresAt <= now ||
        subscription.session.idleExpiresAt <= now ||
        ((subscription.session.mfaRequired || subscription.user.role !== "CUSTOMER") &&
          !subscription.session.mfaVerifiedAt) ||
        subscription.user.status !== "ACTIVE" ||
        !subscription.user.emailVerifiedAt ||
        now.getTime() - event.createdAt.getTime() > 86_400_000
      )
        throw new Error("Ineligible push");
      // Staging never delivers to real subscribers.
      if (env.DEPLOYMENT_ENV === "staging") throw new Error("Staging push disabled");
      subscriptionId = subscription.id;
      const endpoint = pushSubscriptionSchema.parse(
        decryptNotificationPayload(
          subscription.encryptedSubscription as unknown as EncryptedEnvelope,
        ),
      );
      terminal = event.attempts >= 6;
      code = "PUSH_PROVIDER_FAILED";
      await this.send(
        endpoint,
        JSON.stringify({
          notificationId: notification.id,
          endpointHash: subscription.endpointHash,
          audience: subscription.user.role === "CUSTOMER" ? "customer" : "staff",
        }),
        {
          TTL: 300,
          urgency: "normal",
          timeout: 8_000,
          vapidDetails: {
            subject: env.VAPID_SUBJECT!,
            publicKey: env.VAPID_PUBLIC_KEY!,
            privateKey: env.VAPID_PRIVATE_KEY!,
          },
        },
      );
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
      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? Number(error.statusCode)
          : 0;
      if ([404, 410].includes(status) && subscriptionId) {
        await this.database.pushSubscription.updateMany({
          where: { id: subscriptionId },
          data: { disabledAt: new Date() },
        });
        code = "PUSH_SUBSCRIPTION_EXPIRED";
        terminal = true;
      } else if (status >= 400 && status < 500 && status !== 429) terminal = true;
      await this.database.outboxEvent.updateMany({
        where,
        data: {
          status: terminal ? "DEAD_LETTER" : "FAILED",
          lockedAt: null,
          lastError: code,
          availableAt: new Date(
            Date.now() + Math.min(3600, 2 ** event.attempts * 15) * 1000,
          ),
        },
      });
    }
  }
}
