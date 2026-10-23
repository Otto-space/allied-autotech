import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { prisma } from "../../config/database.js";
import {
  supportCustomerEmailAggregate,
  supportCustomerEmailEvent,
  supportEmailProviderOutcomeAggregate,
  supportEmailProviderOutcomeEvent,
} from "../../modules/support/customer-email.js";

const eventTypes = [
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
] as const;
const eventSchema = z
  .object({
    type: z.enum(eventTypes),
    created_at: z.iso.datetime(),
    data: z
      .object({
        email_id: z.string().min(1).max(120),
        tags: z.object({ support_outbox_event_id: z.uuid().optional() }).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export function verifyResendSignature(
  raw: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
) {
  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signatures = headers["svix-signature"];
  if (
    typeof id !== "string" ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(id) ||
    typeof timestamp !== "string" ||
    !/^\d{10}$/.test(timestamp) ||
    typeof signatures !== "string" ||
    raw.length === 0
  )
    return null;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
    return null;
  if (!secret.startsWith("whsec_")) return null;
  const key = Buffer.from(secret.slice(6), "base64");
  if (key.length < 16) return null;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.`)
    .update(raw)
    .digest();
  const authentic = signatures.split(" ").some((part) => {
    if (!part.startsWith("v1,")) return false;
    const supplied = Buffer.from(part.slice(3), "base64");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
  return authentic ? id : null;
}

function eventUuid(id: string) {
  const bytes = createHash("sha256").update(`resend:${id}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createResendWebhookRouter() {
  const router = Router();
  router.post("/", async (req, res, next) => {
    try {
      if (!env.RESEND_WEBHOOK_SECRET) {
        res.status(503).end();
        return;
      }
      const raw = req.body;
      const id = Buffer.isBuffer(raw)
        ? verifyResendSignature(raw, req.headers, env.RESEND_WEBHOOK_SECRET)
        : null;
      if (!id) {
        res.status(401).end();
        return;
      }
      const parsed = eventSchema.safeParse(JSON.parse(raw.toString("utf8")));
      if (!parsed.success) {
        // Other signed Resend events need no support-case action.
        res.status(204).end();
        return;
      }
      const outboxEventId = parsed.data.data.tags?.support_outbox_event_id;
      if (!outboxEventId) {
        res.status(204).end();
        return;
      }
      const source = await prisma.outboxEvent.findFirst({
        where: {
          id: outboxEventId,
          aggregateType: supportCustomerEmailAggregate,
          eventType: supportCustomerEmailEvent,
        },
        select: { id: true },
      });
      if (!source) {
        res.status(204).end();
        return;
      }
      await prisma.outboxEvent.createMany({
        data: [
          {
            eventId: eventUuid(id),
            aggregateType: supportEmailProviderOutcomeAggregate,
            aggregateId: source.id,
            eventType: supportEmailProviderOutcomeEvent,
            status: "PUBLISHED",
            createdAt: new Date(parsed.data.created_at),
            publishedAt: new Date(),
            payload: { type: parsed.data.type },
          },
        ],
        skipDuplicates: true,
      });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}
