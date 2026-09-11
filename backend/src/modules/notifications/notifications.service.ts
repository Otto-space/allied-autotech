import { randomUUID } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { encryptNotificationPayload } from "../../common/security/mfa-encryption.js";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { notificationNotFound } from "./notifications.errors.js";
import { notificationEventTypes } from "./notifications.events.js";
import { assertNotificationActor } from "./notifications.policy.js";
import { NotificationsRepository } from "./notifications.repository.js";
import type {
  NotificationListQuery,
  PreferenceUpdateInput,
} from "./notifications.schemas.js";
import type {
  EnqueueNotification,
  NotificationDeliveryPayload,
} from "./notifications.types.js";
import { notificationPage } from "./notifications.types.js";

type Transaction = Prisma.TransactionClient;

export async function enqueueNotification(
  transaction: Transaction,
  input: EnqueueNotification,
) {
  if (
    input.title.length < 1 ||
    input.title.length > 160 ||
    input.message.length < 1 ||
    input.message.length > 2_000 ||
    input.deduplicationKey.length < 1 ||
    input.deduplicationKey.length > 160
  )
    throw new Error("Invalid internal notification command");

  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`notification:${input.deduplicationKey}`}, 0))
  `;

  const existing = await transaction.notification.findUnique({
    where: { deduplicationKey: input.deduplicationKey },
    select: { id: true },
  });
  if (existing !== null) return existing;

  const recipient = await transaction.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      profile: { select: { phone: true } },
      staffProfile: { select: { phone: true } },
    },
  });
  if (recipient === null) throw new Error("Notification recipient does not exist");

  const notification = await transaction.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      category: input.category,
      title: input.title,
      message: input.message,
      deduplicationKey: input.deduplicationKey,
      ...(input.resourceType === undefined ? {} : { resourceType: input.resourceType }),
      ...(input.resourceId === undefined ? {} : { resourceId: input.resourceId }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    },
    select: { id: true },
  });

  for (const channel of new Set(input.channels ?? [])) {
    const enabledByRuntime =
      channel === "EMAIL" ? env.EMAIL_DELIVERY_ENABLED : env.SMS_DELIVERY_ENABLED;
    if (!enabledByRuntime) continue;
    const preference =
      input.category === "OPERATIONAL" || input.category === "MARKETING"
        ? await transaction.notificationPreference.findUnique({
            where: {
              userId_category_channel: {
                userId: input.userId,
                category: input.category,
                channel,
              },
            },
            select: { enabled: true, consentedAt: true },
          })
        : null;
    const permitted =
      input.category === "MARKETING"
        ? preference?.enabled === true && preference.consentedAt !== null
        : input.category === "OPERATIONAL"
          ? preference?.enabled !== false
          : true;
    if (!permitted) continue;
    const address =
      channel === "EMAIL"
        ? recipient.email
        : (recipient.profile?.phone ?? recipient.staffProfile?.phone);
    if (!address) continue;
    const payload: NotificationDeliveryPayload = {
      channel,
      recipient: address,
      title: input.title,
      message: input.message,
    };
    const eventId = randomUUID();
    const outbox = await transaction.outboxEvent.create({
      data: {
        eventId,
        aggregateType: "Notification",
        aggregateId: notification.id,
        eventType: notificationEventTypes.deliveryRequested,
        payload: {
          encrypted: encryptNotificationPayload(payload),
        } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await transaction.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        outboxEventId: outbox.id,
        channel,
      },
    });
  }
  return notification;
}

export class NotificationsService {
  private readonly repository: NotificationsRepository;

  constructor(private readonly database: PrismaClient = prisma) {
    this.repository = new NotificationsRepository(database);
  }

  async list(actor: AuthenticatedActor, query: NotificationListQuery) {
    assertNotificationActor(actor);
    return notificationPage(await this.repository.list(actor.userId, query), query.limit);
  }

  async markRead(actor: AuthenticatedActor, id: string) {
    assertNotificationActor(actor);
    return this.database.$transaction(async (transaction) => {
      const owned = await this.repository.owned(id, actor.userId, transaction);
      if (owned === null) throw notificationNotFound();
      await this.repository.markRead(actor.userId, id, transaction);
      const updated = await this.repository.owned(id, actor.userId, transaction);
      if (updated === null) throw notificationNotFound();
      return updated;
    });
  }

  async markAllRead(actor: AuthenticatedActor) {
    assertNotificationActor(actor);
    const changed = await this.database.$transaction((transaction) =>
      this.repository.markAllRead(actor.userId, transaction),
    );
    return { updated: changed.count };
  }

  async preferences(actor: AuthenticatedActor) {
    assertNotificationActor(actor);
    return {
      immutableCategories: ["SECURITY", "TRANSACTIONAL"],
      preferences: await this.repository.preferences(actor.userId),
    };
  }

  async updatePreference(
    actor: AuthenticatedActor,
    input: PreferenceUpdateInput,
    context: RequestSecurityContext,
  ) {
    assertNotificationActor(actor);
    return this.database.$transaction(async (transaction) => {
      const existing = await transaction.notificationPreference.findUnique({
        where: {
          userId_category_channel: {
            userId: actor.userId,
            category: input.category,
            channel: input.channel,
          },
        },
      });
      const preference = await transaction.notificationPreference.upsert({
        where: {
          userId_category_channel: {
            userId: actor.userId,
            category: input.category,
            channel: input.channel,
          },
        },
        create: {
          userId: actor.userId,
          category: input.category,
          channel: input.channel,
          enabled: input.enabled,
          ...(input.category === "MARKETING" && input.enabled
            ? { consentedAt: new Date() }
            : {}),
        },
        update: {
          enabled: input.enabled,
          ...(input.category === "MARKETING" &&
          input.enabled &&
          existing?.consentedAt == null
            ? { consentedAt: new Date() }
            : {}),
        },
        select: {
          category: true,
          channel: true,
          enabled: true,
          consentedAt: true,
          updatedAt: true,
        },
      });
      await appendAuditEvent(transaction, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: actor.userId,
        oldValues: { notificationEnabled: existing?.enabled ?? null },
        newValues: {
          notificationCategory: input.category,
          notificationChannel: input.channel,
          notificationEnabled: input.enabled,
        },
        context,
      });
      return preference;
    });
  }
}

export const notificationsService = new NotificationsService();
