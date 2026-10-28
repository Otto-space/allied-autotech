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
export const notificationDestinationSchema = z.object({
  section: z.string().regex(/^\/(?:dashboard|admin)(?:\/[a-z-]+)+$/),
  href: z.string().refine((href) => {
    if (!/^\/(?:dashboard|admin)\//.test(href) || /[\\\u0000-\u0020]/.test(href))
      return false;
    try {
      const url = new URL(href, "https://allied.invalid");
      return url.origin === "https://allied.invalid" && !url.pathname.includes("%");
    } catch {
      return false;
    }
  }, "Invalid internal notification destination"),
  label: z.string().min(1).max(80),
});
const timestamp = z.iso.datetime({ offset: true });
export const notificationSchema = z.object({
  id: z.uuid(),
  destination: notificationDestinationSchema.nullable().optional(),
  type: z.enum(notificationTypes),
  category: z.enum(notificationCategories),
  title: z.string().min(1).max(160),
  message: z.string().min(1).max(2000),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  supportMessageId: z.uuid().nullable().optional(),
  readAt: timestamp.nullable(),
  expiresAt: timestamp.nullable(),
  createdAt: timestamp,
});
export type InboxNotification = z.infer<typeof notificationSchema>;
export const notificationSummarySchema = z
  .object({
    destinations: z
      .array(
        z.object({
          section: notificationDestinationSchema.shape.section,
          count: z.number().int().positive(),
          recordCount: z.number().int().positive(),
          href: notificationDestinationSchema.shape.href,
        }),
      )
      .optional(),
    unreadCount: z.number().int().nonnegative().safe(),
    groups: z.array(
      z.object({
        resourceType: z.string().nullable(),
        type: z.enum(notificationTypes),
        category: z.enum(notificationCategories),
        count: z.number().int().positive().safe(),
      }),
    ),
  })
  .refine(
    (summary) =>
      !summary.destinations ||
      (new Set(summary.destinations.map((d) => d.section)).size ===
        summary.destinations.length &&
        summary.destinations.every((d) => d.recordCount <= d.count) &&
        summary.destinations.reduce((sum, d) => sum + d.count, 0) <= summary.unreadCount),
  )
  .refine(
    (summary) =>
      summary.unreadCount === summary.groups.reduce((sum, group) => sum + group.count, 0),
  );
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;
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
  version: z.number().int().min(1).max(2147483647),
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
      channels: z
        .object({ email: z.boolean(), sms: z.boolean(), marketing: z.boolean() })
        .optional(),
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

export const preferenceWriteBodySchema = z
  .object({
    category: z.enum(["OPERATIONAL", "MARKETING"]),
    channel: z.enum(["EMAIL", "SMS"]),
    enabled: z.boolean(),
    expectedVersion: z.number().int().min(0).max(2147483646),
  })
  .strict();
export const preferenceWriteResultSchema = z.object({
  preference: preferenceSchema,
  appliedVersion: z.number().int().positive(),
  replayed: z.boolean(),
});
