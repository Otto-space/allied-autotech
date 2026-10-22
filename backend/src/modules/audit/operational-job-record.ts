import type { Prisma } from "../../generated/prisma/client.js";

// Deliberately exclude payloads and raw diagnostics from administrative inspection.
export const outboxJobSelect = {
  id: true,
  eventId: true,
  aggregateType: true,
  aggregateId: true,
  eventType: true,
  status: true,
  attempts: true,
  availableAt: true,
  lockedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OutboxEventSelect;
export const webhookJobSelect = {
  id: true,
  eventType: true,
  status: true,
  processingAttempts: true,
  nextAttemptAt: true,
  lockedAt: true,
  receivedAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentWebhookEventSelect;
