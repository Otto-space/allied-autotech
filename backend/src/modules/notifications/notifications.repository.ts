import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import type { NotificationListQuery } from "./notifications.schemas.js";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
export const notificationSelect = {
  id: true,
  type: true,
  category: true,
  title: true,
  message: true,
  resourceType: true,
  resourceId: true,
  readAt: true,
  expiresAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export class NotificationsRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  list(userId: string, query: NotificationListQuery) {
    const now = new Date();
    return this.database.notification.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(query.unreadOnly ? { readAt: null } : {}),
        ...(query.type ? { type: query.type } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      select: notificationSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
  }

  markRead(userId: string, id: string, client: DatabaseClient) {
    return client.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  owned(id: string, userId: string, client: DatabaseClient) {
    return client.notification.findFirst({
      where: { id, userId },
      select: notificationSelect,
    });
  }

  markAllRead(userId: string, client: DatabaseClient) {
    return client.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  preferences(userId: string, client: DatabaseClient = this.database) {
    return client.notificationPreference.findMany({
      where: { userId },
      select: {
        category: true,
        channel: true,
        enabled: true,
        consentedAt: true,
        updatedAt: true,
      },
      orderBy: [{ category: "asc" }, { channel: "asc" }],
    });
  }
}
