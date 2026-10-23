import { z } from "zod";
export const supportEmailDeliveryPageSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        status: z.enum(["QUEUED", "SENDING", "SENT", "RETRYING", "FAILED", "NOT_SENT"]),
        reason: z
          .enum([
            "CHANNEL_DISABLED",
            "CONSENT_WITHDRAWN",
            "NO_RECIPIENT",
            "SUPPORT_REPLY_ADDRESS_MISSING",
            "STAGING_RECIPIENT_NOT_ALLOWLISTED",
            "SUPPORT_EMAIL_FAILED",
            "PROVIDER_REJECTED",
            "RETRY_EXHAUSTED",
          ])
          .nullable(),
        createdAt: z.iso.datetime(),
        sentAt: z.iso.datetime().nullable(),
        attempts: z.number().int().nonnegative(),
        nextRetryAt: z.iso.datetime().nullable(),
      }),
    )
    .max(20),
});
export type SupportEmailPage = z.infer<typeof supportEmailDeliveryPageSchema>;
