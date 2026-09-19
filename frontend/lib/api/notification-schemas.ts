import { z } from "zod";
export const notificationTypes = [
  "BOOKING",
  "QUOTATION",
  "WORK_ORDER",
  "ORDER",
  "PAYMENT",
  "REFUND",
  "DISPUTE",
  "INSPECTION",
  "VEHICLE_TRANSACTION",
  "ENQUIRY",
  "COMPLAINT",
  "REVIEW",
  "PROMOTION",
  "SYSTEM",
] as const;
export const notificationCategories = [
  "SECURITY",
  "TRANSACTIONAL",
  "OPERATIONAL",
  "MARKETING",
] as const;
const timestamp = z.iso.datetime({ offset: true });
export const notificationSchema = z.object({
  id: z.uuid(),
  type: z.enum(notificationTypes),
  category: z.enum(notificationCategories),
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(2000),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  readAt: timestamp.nullable(),
  expiresAt: timestamp.nullable(),
  createdAt: timestamp,
});
export type InboxNotification = z.infer<typeof notificationSchema>;
export const parseNotifications = (value: unknown) =>
  z
    .object({
      items: z
        .array(notificationSchema)
        .max(100)
        .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
      nextCursor: z.uuid().optional(),
    })
    .parse(value);
export const preferenceSchema = z.object({
  category: z.enum(["OPERATIONAL", "MARKETING"]),
  channel: z.enum(["EMAIL", "SMS"]),
  enabled: z.boolean(),
  consentedAt: timestamp.nullable(),
  updatedAt: timestamp,
});
export type NotificationPreference = z.infer<typeof preferenceSchema>;
export const parseNotificationPreferences = (value: unknown) =>
  z
    .object({
      immutableCategories: z
        .array(z.enum(["SECURITY", "TRANSACTIONAL"]))
        .length(2)
        .refine((items) => new Set(items).size === 2),
      preferences: z
        .array(preferenceSchema)
        .max(4)
        .refine(
          (items) =>
            new Set(items.map((item) => `${item.category}:${item.channel}`)).size ===
            items.length,
        ),
    })
    .parse(value);
export const markAllReadSchema = z.object({
  updated: z.number().int().nonnegative().safe(),
});
export function preferenceEnabled(
  category: NotificationPreference["category"],
  preference?: NotificationPreference,
) {
  return category === "MARKETING"
    ? preference?.enabled === true && preference.consentedAt !== null
    : preference?.enabled !== false;
}
