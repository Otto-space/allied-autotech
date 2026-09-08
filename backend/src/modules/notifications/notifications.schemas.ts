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
  })
  .strict();
export const notificationsEmptyBodySchema = z.object({}).strict().default({});
export const notificationsEmptyQuerySchema = z.object({}).strict().default({});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type PreferenceUpdateInput = z.infer<typeof preferenceUpdateBodySchema>;
