import { resolveNotificationTargets } from "./notification-targets.js";
import { notificationSelect } from "./notifications.repository.js";
import { lockWorkforce } from "../organization/workforce-access.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import type {
  NotificationAttentionQuery,
  NotificationContextQuery,
  NotificationContextRead,
} from "./notifications.schemas.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { writePreferenceReceipt } from "./preference-write.js";
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
import { pushConfigured } from "./push.service.js";
import { pushEventType } from "./push.schemas.js";

type Transaction = Prisma.TransactionClient;

export async function enqueueNotification(
  transaction: Transaction,
  input: EnqueueNotification,
) {
  if (input.category === "MARKETING")
    throw new Error("Marketing execution is disabled pending owner approval");
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
      ...(input.supportMessageId === undefined
        ? {}
        : { supportMessageId: input.supportMessageId }),
      ...(input.resourceType === undefined ? {} : { resourceType: input.resourceType }),
      ...(input.resourceId === undefined ? {} : { resourceId: input.resourceId }),
      ...(input.expiresAt === undefined ? {} : { expiresAt: input.expiresAt }),
    },
    select: { id: true },
  });

  if (pushConfigured()) {
    const now = new Date();
    const subscriptions = await transaction.pushSubscription.findMany({
      where: {
        userId: input.userId,
        disabledAt: null,
        session: { revokedAt: null, expiresAt: { gt: now }, idleExpiresAt: { gt: now } },
      },
      select: { id: true },
    });
    if (subscriptions.length)
      await transaction.outboxEvent.createMany({
        data: subscriptions.map((subscription) => ({
          eventId: randomUUID(),
          aggregateType: "Notification",
          aggregateId: notification.id,
          eventType: pushEventType,
          payload: { subscriptionId: subscription.id, notificationId: notification.id },
        })),
      });
  }
  for (const channel of new Set(input.channels ?? [])) {
    const enabledByRuntime =
      channel === "EMAIL" ? env.EMAIL_DELIVERY_ENABLED : env.SMS_DELIVERY_ENABLED;
    const preference =
      input.category === "OPERATIONAL"
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
      input.category === "OPERATIONAL" ? preference?.enabled !== false : true;
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
      ...(input.bookingAction ? { bookingAction: input.bookingAction } : {}),
    };
    const eventId = randomUUID();
    const outbox = await transaction.outboxEvent.create({
      data: {
        eventId,
        aggregateType: "Notification",
        aggregateId: notification.id,
        eventType: notificationEventTypes.deliveryRequested,
        status: enabledByRuntime ? "PENDING" : "DEAD_LETTER",
        ...(enabledByRuntime ? {} : { lastError: "CHANNEL_DISABLED" }),
        payload: {
          encrypted: encryptNotificationPayload(payload),
        } as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    await transaction.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        status: enabledByRuntime ? "PENDING" : "DEAD_LETTER",
        ...(enabledByRuntime ? {} : { lastErrorCode: "CHANNEL_DISABLED" }),
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
    return this.database.$transaction(
      async (tx) => {
        if (
          query.cursor &&
          !(await this.repository.owned(query.cursor, actor.userId, tx))
        )
          throw notificationNotFound();
        const rows = await this.repository.list(actor.userId, query, tx);
        const targets = await resolveNotificationTargets(tx, actor, rows);
        return notificationPage(
          rows.map((row) => ({ ...row, destination: targets.get(row.id) ?? null })),
          query.limit,
        );
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async detail(actor: AuthenticatedActor, id: string) {
    assertNotificationActor(actor);
    return this.database.$transaction(
      async (tx) => {
        const item = await this.repository.owned(id, actor.userId, tx);
        if (!item || (item.expiresAt && item.expiresAt <= new Date()))
          throw notificationNotFound();
        const targets = await resolveNotificationTargets(tx, actor, [item]);
        return { ...item, destination: targets.get(id) ?? null };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  private unreadReferences(userId: string, tx: Transaction) {
    return tx.notification.findMany({
      where: {
        userId,
        readAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        resourceType: true,
        resourceId: true,
        supportMessageId: true,
        type: true,
        category: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
  async summary(actor: AuthenticatedActor) {
    assertNotificationActor(actor);
    return this.database.$transaction(
      async (tx) => {
        const rows = await this.unreadReferences(actor.userId, tx);
        const targets = await resolveNotificationTargets(tx, actor, rows);
        const grouped = new Map<
          string,
          {
            resourceType: string | null;
            type: (typeof rows)[number]["type"];
            category: (typeof rows)[number]["category"];
            count: number;
          }
        >();
        const sections = new Map<
          string,
          { section: string; count: number; records: Set<string>; first: string }
        >();
        for (const row of rows) {
          const key = JSON.stringify([row.resourceType, row.type, row.category]);
          const group = grouped.get(key) ?? {
            resourceType: row.resourceType,
            type: row.type,
            category: row.category,
            count: 0,
          };
          group.count++;
          grouped.set(key, group);
          const target = targets.get(row.id);
          if (!target || !row.resourceType || !row.resourceId) continue;
          const section = sections.get(target.section) ?? {
            section: target.section,
            count: 0,
            records: new Set<string>(),
            first: row.id,
          };
          section.count++;
          section.records.add(`${row.resourceType.toUpperCase()}:${row.resourceId}`);
          sections.set(target.section, section);
        }
        const inbox =
          actor.role === "CUSTOMER" ? "/dashboard/notifications" : "/admin/notifications";
        return {
          unreadCount: rows.length,
          groups: [...grouped.values()],
          destinations: [...sections.values()].map((s) => ({
            section: s.section,
            count: s.count,
            recordCount: s.records.size,
            href:
              s.records.size === 1
                ? `${inbox}?notification=${s.first}`
                : `${inbox}?attention=${encodeURIComponent(s.section)}`,
          })),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async attention(actor: AuthenticatedActor, query: NotificationAttentionQuery) {
    assertNotificationActor(actor);
    return this.database.$transaction(
      async (tx) => {
        const rows = await this.unreadReferences(actor.userId, tx);
        const targets = await resolveNotificationTargets(tx, actor, rows);
        const matching = rows.filter((r) => targets.get(r.id)?.section === query.section);
        const offset = query.cursor
          ? matching.findIndex((r) => r.id === query.cursor) + 1
          : 0;
        if (query.cursor && offset === 0) throw notificationNotFound();
        const ids = matching.slice(offset, offset + query.limit + 1).map((r) => r.id);
        const page = ids.length
          ? await tx.notification.findMany({
              where: { userId: actor.userId, id: { in: ids } },
              select: notificationSelect,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            })
          : [];
        return notificationPage(
          page.map((r) => ({ ...r, destination: targets.get(r.id)! })),
          query.limit,
        );
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async context(actor: AuthenticatedActor, query: NotificationContextQuery) {
    assertNotificationActor(actor);
    return this.database.$transaction(
      async (tx) => {
        const target = await resolveNotificationTargets(tx, actor, [
          { ...query, id: "target", supportMessageId: null },
        ]);
        if (!target.has("target")) throw notificationNotFound();
        const rows = await tx.notification.findMany({
          where: {
            userId: actor.userId,
            resourceType: { equals: query.resourceType, mode: "insensitive" },
            resourceId: query.resourceId,
            ...(query.messageIds
              ? {
                  AND: [
                    {
                      OR: [
                        { supportMessageId: null },
                        { supportMessageId: { in: query.messageIds } },
                      ],
                    },
                  ],
                }
              : {}),
            readAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: notificationSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 101,
        });
        const page = rows.slice(0, 100);
        const targets = await resolveNotificationTargets(tx, actor, page);
        return {
          hasMore: rows.length > 100,
          items: page
            .filter((r) => targets.has(r.id))
            .map((r) => ({ ...r, destination: targets.get(r.id)! })),
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async readContext(actor: AuthenticatedActor, body: NotificationContextRead) {
    assertNotificationActor(actor);
    return this.database.$transaction(async (tx) => {
      if (actor.role !== "CUSTOMER") {
        await lockWorkforce(tx);
        await lockAccessActor(tx, actor);
      }
      const rows = await tx.notification.findMany({
        where: {
          userId: actor.userId,
          resourceType: { equals: body.resourceType, mode: "insensitive" },
          resourceId: body.resourceId,
          id: { in: body.notificationIds },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: notificationSelect,
      });
      const targets = await resolveNotificationTargets(tx, actor, rows);
      if (rows.length !== body.notificationIds.length || targets.size !== rows.length)
        throw notificationNotFound();
      const changed = await tx.notification.updateMany({
        where: { userId: actor.userId, id: { in: body.notificationIds }, readAt: null },
        data: { readAt: new Date() },
      });
      return { updated: changed.count };
    });
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
    rawKey: string,
  ) {
    assertNotificationActor(actor);
    return withTransactionRetry(
      this.database,
      async (transaction) =>
        writePreferenceReceipt(
          transaction,
          actor.userId,
          rawKey,
          input,
          async (input) => {
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
                id: true,
                version: true,
                category: true,
                channel: true,
                enabled: true,
                consentedAt: true,
                updatedAt: true,
              },
            });
            await transaction.consentRecord.create({
              data: {
                userId: actor.userId,
                scope: `${input.category}:${input.channel}`,
                source: "authenticated-preferences",
                wordingVersion: "owner-checklist-Q12-pending-marketing-wording",
                granted: input.enabled,
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
          },
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

export const notificationsService = new NotificationsService();
