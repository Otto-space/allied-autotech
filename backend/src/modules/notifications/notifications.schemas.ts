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
