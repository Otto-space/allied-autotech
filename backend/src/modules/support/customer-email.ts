import { renderBrandEmail } from "../../common/email/brand-template.js";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { AppError } from "../../common/errors/app-error.js";
import { z } from "zod";
import { env } from "../../config/env.js";
import { encryptNotificationPayload } from "../../common/security/mfa-encryption.js";
import { Prisma } from "../../generated/prisma/client.js";
import { enqueueNotification } from "../notifications/notifications.service.js";
import { renderNotificationEmail } from "../notifications/notification-delivery.templates.js";

export const supportCustomerEmailEvent = "support.customer-email.requested";
export const supportCustomerEmailAggregate = "SupportCustomerEmail";
export const supportEmailProviderOutcomeAggregate = "SupportEmailProviderOutcome";
export const supportEmailProviderOutcomeEvent = "support.customer-email.provider-outcome";
export const supportEmailPayloadSchema = z
  .object({
    recipient: z.email().nullable(),
    replyTo: z.email().nullable(),
    userId: z.uuid().nullable(),
    kind: z.enum(["enquiry", "complaint"]),
    conversationId: z.uuid(),
    title: z
      .string()
      .min(1)
      .max(160)
      .refine((v) => !/[\r\n]/u.test(v)),
    message: z.string().min(1).max(6000),
  })
  .strict();

const reasons = [
  "CHANNEL_DISABLED",
  "CONSENT_WITHDRAWN",
  "NO_RECIPIENT",
  "SUPPORT_REPLY_ADDRESS_MISSING",
  "STAGING_RECIPIENT_NOT_ALLOWLISTED",
  "SUPPORT_EMAIL_FAILED",
  "PROVIDER_REJECTED",
  "RETRY_EXHAUSTED",
] as const;
export const supportEmailDeliverySchema = z.object({
  noticeRevision: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  noticeEligible: z.boolean().optional(),
  noticeDismissed: z.boolean().optional(),
  id: z.uuid(),
  status: z.enum(["QUEUED", "SENDING", "SENT", "RETRYING", "FAILED", "NOT_SENT"]),
  reason: z.enum(reasons).nullable(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
  attempts: z.number().int().nonnegative(),
  nextRetryAt: z.iso.datetime().nullable(),
  providerStatus: z
    .enum(["DELIVERED", "DELAYED", "BOUNCED", "COMPLAINED", "FAILED", "SUPPRESSED"])
    .nullable(),
  providerUpdatedAt: z.iso.datetime().nullable(),
});
export const supportEmailDeliveryPageSchema = z.object({
  items: z.array(supportEmailDeliverySchema).max(20),
});
export const supportDeliveryDismissSchema = z
  .object({
    notices: z
      .array(
        z.object({ id: z.uuid(), revision: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (v) => new Set(v.notices.map((n) => n.id)).size === v.notices.length,
    "Duplicate delivery notice",
  );

export function deliveryNoticeRevision(item: {
  status: string;
  reason: string | null;
  attempts: number;
  providerStatus: string | null;
  providerUpdatedAt: string | null;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        item.status,
        item.reason,
        item.attempts,
        item.providerStatus,
        item.providerUpdatedAt,
      ]),
    )
    .digest("hex");
}
export async function dismissSupportDeliveryNotices(
  tx: Prisma.TransactionClient,
  userId: string,
  id: string,
  body: unknown,
) {
  const input = supportDeliveryDismissSchema.parse(body);
  // Serialize with worker updates; provider revisions arriving afterwards remain
  // new notices. Lock only explicitly reviewed delivery records, in stable order.
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "OutboxEvent" WHERE "id" IN (${Prisma.join(
      input.notices
        .map((n) => n.id)
        .sort()
        .map((key) => Prisma.sql`${key}::uuid`),
    )}) AND "aggregateId" = ${id} AND "aggregateType" = ${supportCustomerEmailAggregate} AND "eventType" = ${supportCustomerEmailEvent} ORDER BY "id" FOR UPDATE`,
  );
  const page = await supportEmailDeliveries(tx, id, userId);
  for (const notice of input.notices) {
    const item = page.items.find((i) => i.id === notice.id);
    if (!item?.noticeEligible || item.noticeRevision !== notice.revision)
      throw new AppError({
        code: "CONFLICT",
        statusCode: 409,
        message:
          "A delivery notice changed or is unavailable. Refresh and review visible notices.",
      });
  }
  await tx.supportDeliveryNoticeDismissal.createMany({
    data: input.notices.map((n) => ({ userId, deliveryId: n.id, revision: n.revision })),
    skipDuplicates: true,
  });
  return supportEmailDeliveries(tx, id, userId);
}

// Caller holds the conversation lock/version check. This outbox entry and the
// message/status change commit together; a rollback cannot send an email.
export async function enqueueSupportCustomerUpdate(
  tx: Prisma.TransactionClient,
  input: {
    kind: "enquiry" | "complaint";
    record: { id: string; email: string | null; customer: { userId: string } | null };
    messageId: string | null;
    status?: string;
    response?: string | undefined;
    version?: number;
  },
) {
  const { record, kind } = input;
  const userId = record.customer?.userId ?? null;
  const title = input.status
    ? `Your ${kind} is now ${input.status.toLowerCase().replaceAll("_", " ")}`
    : "New support reply";
  const update = input.status
    ? `Your ${kind} is now ${input.status.toLowerCase().replaceAll("_", " ")}.`
    : `Our team has replied to your ${kind}.`;
  let recipient = record.email;
  let optedOut = false;
  if (userId) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    recipient = user?.email ?? null;
    const preference = await tx.notificationPreference.findUnique({
      where: {
        userId_category_channel: { userId, category: "OPERATIONAL", channel: "EMAIL" },
      },
      select: { enabled: true },
    });
    optedOut = preference?.enabled === false;
    // Account notification only. The support outbox below owns the single email
    // for both a status change and its optional resolution message.
    await enqueueNotification(tx, {
      userId,
      type: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
      category: "OPERATIONAL",
      title,
      message: update,
      deduplicationKey: `support:${kind}:${record.id}:${input.messageId ?? `status:${input.version}`}`,
      resourceType: kind === "enquiry" ? "ENQUIRY" : "COMPLAINT",
      resourceId: record.id,
      ...(input.messageId ? { supportMessageId: input.messageId } : {}),
      channels: [],
    });
  }
  const replyTo = env.DEPARTMENT_SUPPORT_EMAIL ?? env.RESEND_REPLY_TO_EMAIL ?? null;
  const reason = !recipient
    ? "NO_RECIPIENT"
    : !replyTo
      ? "SUPPORT_REPLY_ADDRESS_MISSING"
      : optedOut
        ? "CONSENT_WITHDRAWN"
        : !env.EMAIL_DELIVERY_ENABLED
          ? "CHANNEL_DISABLED"
          : null;
  const payload = supportEmailPayloadSchema.parse({
    recipient,
    replyTo,
    userId,
    kind,
    conversationId: record.id,
    title,
    // Registered users read their private conversation after signing in. Guests
    // receive the actual response and can reply using their ordinary mailbox.
    message: `Reference: ${record.id}\n\n${update}${!userId && input.response ? `\n\n${input.response}` : ""}\n\n${userId ? "Sign in to view the response in your account." : "Reply to this email to contact Customer Support. Please keep the reference in your reply."}`,
  });
  await tx.outboxEvent.create({
    data: {
      eventId: randomUUID(),
      aggregateType: supportCustomerEmailAggregate,
      aggregateId: record.id,
      eventType: supportCustomerEmailEvent,
      status: reason ? "DEAD_LETTER" : "PENDING",
      lastError: reason,
      payload: {
        encrypted: encryptNotificationPayload(payload),
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

export function renderSupportCustomerEmail(
  payload: z.infer<typeof supportEmailPayloadSchema>,
) {
  const rendered = renderNotificationEmail({
    ...payload,
    recipient: payload.recipient ?? "",
    channel: "EMAIL",
  });
  if (!payload.userId) return rendered;
  // Build the link from trusted runtime configuration, never from message text.
  const url = new URL(
    `/dashboard/support/${payload.kind === "enquiry" ? "enquiries" : "complaints"}/${payload.conversationId}`,
    env.FRONTEND_URL[0],
  ).href;
  return renderBrandEmail({
    title: payload.title,
    message: payload.message,
    eyebrow: "Customer care",
    action: { label: "View response", url },
  });
}

export async function supportEmailDeliveries(
  tx: Prisma.TransactionClient,
  id: string,
  userId?: string,
) {
  const rows = await tx.outboxEvent.findMany({
    where: {
      aggregateType: supportCustomerEmailAggregate,
      aggregateId: id,
      eventType: supportCustomerEmailEvent,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      id: true,
      status: true,
      lastError: true,
      createdAt: true,
      publishedAt: true,
      attempts: true,
      availableAt: true,
    },
  });
  // One latest observation per delivery. A noisy provider record must not evict
  // another delivery's known failure from a shared arbitrary event limit.
  const outcomeRows = rows.length
    ? await tx.$queryRaw<
        { aggregateId: string; createdAt: Date; payload: Prisma.JsonValue }[]
      >(
        Prisma.sql`SELECT DISTINCT ON ("aggregateId") "aggregateId", "createdAt", "payload" FROM "OutboxEvent" WHERE "aggregateType" = ${supportEmailProviderOutcomeAggregate} AND "eventType" = ${supportEmailProviderOutcomeEvent} AND "aggregateId" IN (${Prisma.join(rows.map((r) => r.id))}) AND "payload"->>'type' IN ('email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed') ORDER BY "aggregateId", "createdAt" DESC, "id" DESC`,
      )
    : [];
  const outcomes = new Map<string, { type: string; at: Date }>();
  for (const row of outcomeRows) {
    if (outcomes.has(row.aggregateId)) continue;
    const type = (row.payload as { type?: unknown } | null)?.type;
    if (
      typeof type === "string" &&
      [
        "email.delivered",
        "email.delivery_delayed",
        "email.bounced",
        "email.complained",
        "email.failed",
        "email.suppressed",
      ].includes(type)
    )
      outcomes.set(row.aggregateId, { type, at: row.createdAt });
  }
  const items = rows.map((row) => ({
    id: row.id,
    status:
      row.status === "PUBLISHED"
        ? "SENT"
        : row.status === "PROCESSING"
          ? "SENDING"
          : row.status === "FAILED"
            ? "RETRYING"
            : row.status === "DEAD_LETTER"
              ? [
                  "CHANNEL_DISABLED",
                  "CONSENT_WITHDRAWN",
                  "NO_RECIPIENT",
                  "SUPPORT_REPLY_ADDRESS_MISSING",
                ].includes(row.lastError ?? "")
                ? "NOT_SENT"
                : "FAILED"
              : "QUEUED",
    reason:
      reasons.find((r) => r === row.lastError) ??
      (row.lastError ? "SUPPORT_EMAIL_FAILED" : null),
    createdAt: row.createdAt.toISOString(),
    sentAt: row.publishedAt?.toISOString() ?? null,
    attempts: row.attempts,
    nextRetryAt: row.status === "FAILED" ? row.availableAt.toISOString() : null,
    providerStatus:
      outcomes
        .get(row.id)
        ?.type.replace("email.", "")
        .replace("delivery_delayed", "delayed")
        .toUpperCase() ?? null,
    providerUpdatedAt: outcomes.get(row.id)?.at.toISOString() ?? null,
  }));
  const dismissed =
    userId && rows.length
      ? await tx.supportDeliveryNoticeDismissal.findMany({
          where: { userId, deliveryId: { in: rows.map((r) => r.id) } },
          select: { deliveryId: true, revision: true },
        })
      : [];
  const keys = new Set(dismissed.map((r) => `${r.deliveryId}:${r.revision}`));
  return {
    items: items.map((item) => {
      const noticeRevision = deliveryNoticeRevision(item);
      return {
        ...item,
        noticeRevision,
        noticeEligible:
          ["FAILED", "NOT_SENT", "RETRYING"].includes(item.status) ||
          ["DELAYED", "BOUNCED", "COMPLAINED", "FAILED", "SUPPRESSED"].includes(
            item.providerStatus ?? "",
          ),
        noticeDismissed: keys.has(`${item.id}:${noticeRevision}`),
      };
    }),
  };
}
