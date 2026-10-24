import { z } from "zod";

export const notificationListQuerySchema = z
  .object({
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    unreadOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    type: z
      .enum([
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
      ])
      .optional(),
    category: z
      .enum(["SECURITY", "TRANSACTIONAL", "OPERATIONAL", "MARKETING"])
      .optional(),
  })
  .strict();
export const notificationParamsSchema = z.object({ notificationId: z.uuid() }).strict();
export const notificationSummarySchema = z.object({
  destinations: z.array(
    z.object({
      section: z.string(),
      count: z.number().int().positive(),
      recordCount: z.number().int().positive(),
      href: z.string(),
    }),
  ),
  unreadCount: z.number().int().nonnegative().safe(),
  groups: z.array(
    z.object({
      resourceType: z.string().nullable(),
      type: notificationListQuerySchema.shape.type.unwrap(),
      category: notificationListQuerySchema.shape.category.unwrap(),
      count: z.number().int().positive().safe(),
    }),
  ),
});
export const preferenceUpdateBodySchema = z
  .object({
    category: z.enum(["OPERATIONAL", "MARKETING"]),
    channel: z.enum(["EMAIL", "SMS"]),
    enabled: z.boolean(),
    expectedVersion: z.number().int().min(0).max(2147483646),
  })
  .strict();
export const notificationsEmptyBodySchema = z.object({}).strict().default({});
export const notificationsEmptyQuerySchema = z.object({}).strict().default({});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type PreferenceUpdateInput = z.infer<typeof preferenceUpdateBodySchema>;

export const preferenceRequestKeySchema = z
  .string()
  .regex(
    /^preference-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const preferenceRequestHeadersSchema = z.object({
  "idempotency-key": preferenceRequestKeySchema,
});
export const preferenceResponseSchema = z.object({
  category: z.enum(["OPERATIONAL", "MARKETING"]),
  channel: z.enum(["EMAIL", "SMS"]),
  enabled: z.boolean(),
  version: z.number().int().positive(),
  consentedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
});
export const preferenceWriteResponseSchema = z.object({
  preference: preferenceResponseSchema,
  appliedVersion: z.number().int().positive(),
  replayed: z.boolean(),
});

export const notificationTargetSchema = z.object({
  section: z.string(),
  href: z.string(),
  label: z.string(),
});
export const notificationContextQuerySchema = z
  .object({
    resourceType: z.enum([
      "BOOKING",
      "WORKFORCE_JOB",
      "ORDER",
      "PAYMENT",
      "INVOICE",
      "VEHICLE_TRANSACTION",
      "ENQUIRY",
      "COMPLAINT",
      "REVIEW",
      "REFUND",
      "DISPUTE",
    ]),
    resourceId: z.uuid(),
    messageIds: z
      .string()
      .max(1900)
      .transform((value) => value.split(","))
      .pipe(z.array(z.uuid()).min(1).max(50))
      .optional(),
  })
  .strict();
export const notificationContextReadSchema = notificationContextQuerySchema
  .omit({ messageIds: true })
  .extend({
    notificationIds: z
      .array(z.uuid())
      .min(1)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length),
  });
export const notificationAttentionQuerySchema = z
  .object({
    section: z.enum([
      "/dashboard/bookings",
      "/dashboard/orders",
      "/dashboard/payments",
      "/dashboard/invoices",
      "/dashboard/vehicle-transactions",
      "/dashboard/support",
      "/dashboard/reviews",
      "/admin/bookings",
      "/admin/orders",
      "/admin/payments",
      "/admin/invoices",
      "/admin/vehicle-sales",
      "/admin/support",
      "/admin/refunds",
      "/admin/payment-disputes",
      "/admin/payment-disputes/work",
      "/admin/workforce/jobs",
      "/admin/workforce/bookings",
      "/admin/workforce/orders",
      "/admin/workforce/enquiries",
      "/admin/workforce/complaints",
      "/admin/workforce/finance",
    ]),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export type NotificationContextQuery = z.infer<typeof notificationContextQuerySchema>;
export type NotificationContextRead = z.infer<typeof notificationContextReadSchema>;
export type NotificationAttentionQuery = z.infer<typeof notificationAttentionQuerySchema>;
