import { randomUUID } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { encryptNotificationPayload } from "../../common/security/mfa-encryption.js";
import type { Prisma } from "../../generated/prisma/client.js";

export const departmentEmailEvent = "support.department-email.requested";
export const departmentEmailPayloadSchema = z
  .object({
    recipient: z.email(),
    replyTo: z.email(),
    title: z
      .string()
      .min(1)
      .max(160)
      .refine((value) => !/[\r\n]/u.test(value)),
    message: z.string().min(1).max(6_000),
  })
  .strict();

export function departmentRecipient(type: string, settings = env): string | undefined {
  switch (type) {
    case "GENERAL":
      return settings.DEPARTMENT_INFO_EMAIL;
    case "PRODUCT":
    case "VEHICLE":
    case "QUOTATION":
      return settings.DEPARTMENT_SALES_EMAIL;
    case "SERVICE":
    case "BOOKING":
    case "COMPLAINT":
      return settings.DEPARTMENT_SUPPORT_EMAIL;
    default:
      throw new Error("Unknown department enquiry type");
  }
}

export async function enqueueDepartmentEmail(
  transaction: Prisma.TransactionClient,
  input: { id: string; type: string; email: string; subject: string; message: string },
) {
  const recipient = departmentRecipient(input.type);
  // Routing is opt-in. Existing deployments without department destinations
  // continue storing enquiries in the dashboard without attempting email.
  if (!recipient) return;
  const payload = departmentEmailPayloadSchema.parse({
    recipient,
    replyTo: input.email,
    title: `New ${input.type.toLowerCase()} request — Allied AutoTech`,
    message: `Reference: ${input.id}\nSubject: ${input.subject}\n\n${input.message}\n\nReview and manage this request in the staff dashboard.`,
  });
  // Created in the same transaction as the request, inside its existing
  // idempotency receipt. No direct provider calls or additional schema needed.
  await transaction.outboxEvent.create({
    data: {
      eventId: randomUUID(),
      aggregateType: "SupportDepartmentEmail",
      aggregateId: input.id,
      eventType: departmentEmailEvent,
      status: env.EMAIL_DELIVERY_ENABLED ? "PENDING" : "DEAD_LETTER",
      ...(env.EMAIL_DELIVERY_ENABLED ? {} : { lastError: "CHANNEL_DISABLED" }),
      payload: {
        encrypted: encryptNotificationPayload(payload),
      } as unknown as Prisma.InputJsonValue,
    },
  });
}
