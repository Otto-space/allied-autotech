import type {
  NotificationCategory,
  NotificationChannel,
  NotificationType,
} from "../../generated/prisma/enums.js";

export interface EnqueueNotification {
  userId: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  deduplicationKey: string;
  resourceType?: string;
  resourceId?: string;
  channels?: readonly Exclude<NotificationChannel, "IN_APP">[];
  expiresAt?: Date;
}

export interface NotificationDeliveryPayload {
  channel: "EMAIL" | "SMS";
  recipient: string;
  title: string;
  message: string;
}

export function notificationPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, ...(rows.length > limit && last ? { nextCursor: last.id } : {}) };
}
