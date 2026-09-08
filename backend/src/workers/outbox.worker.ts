import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import { assertIdentityWorkerEnvironment } from "../config/env.js";
import {
  decryptIdentityPayload,
  type EncryptedEnvelope,
} from "../common/security/mfa-encryption.js";
import { logger } from "../common/observability/logger.js";
import { isStagingRecipientAllowed } from "../common/security/messaging-recipients.js";
import { renderIdentityEmail } from "../modules/identity/identity-email.templates.js";
import { identityEventTypes } from "../modules/identity/identity.events.js";
import type { IdentityEmailPayload } from "../modules/identity/identity.types.js";
import type { EmailProvider } from "../providers/messaging/email-provider.port.js";
import { ResendEmailProvider } from "../providers/messaging/resend-email.adapter.js";

interface ClaimedEvent {
  id: string;
  eventId: string;
  eventType: string;
  payload: unknown;
  attempts: number;
}

function readEnvelope(payload: unknown): EncryptedEnvelope {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("encrypted" in payload) ||
    typeof payload.encrypted !== "object" ||
    payload.encrypted === null
  ) {
    throw new Error("Invalid encrypted outbox payload");
  }
  return payload.encrypted as EncryptedEnvelope;
}

export class IdentityOutboxWorker {
  constructor(
    private readonly provider: EmailProvider,
    private readonly database: PrismaClient = prisma,
  ) {}

  async runOnce(batchSize = 20): Promise<number> {
    const boundedBatchSize = Math.max(1, Math.min(batchSize, 100));
    const events = await this.database.$queryRaw<ClaimedEvent[]>`
      WITH candidates AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE (
          ("status" IN ('PENDING', 'FAILED') AND "availableAt" <= CURRENT_TIMESTAMP)
          OR ("status" = 'PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '10 minutes')
        )
        AND "eventType" IN (
          ${identityEventTypes.verificationEmailRequested},
          ${identityEventTypes.passwordResetEmailRequested},
          ${identityEventTypes.privilegedInvitationEmailRequested}
        )
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${boundedBatchSize}
      )
      UPDATE "OutboxEvent" AS event
      SET "status" = 'PROCESSING',
          "lockedAt" = CURRENT_TIMESTAMP,
          "attempts" = event."attempts" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      FROM candidates
      WHERE event."id" = candidates."id"
      RETURNING event."id", event."eventId", event."eventType", event."payload", event."attempts"
    `;

    for (const event of events) {
      await this.deliver(event);
    }
    return events.length;
  }

  async cleanupExpiredIdentityState(batchSize = 500): Promise<number> {
    const boundedBatchSize = Math.max(1, Math.min(batchSize, 2_000));
    const throttleCount = await this.database.$executeRaw`
      DELETE FROM "AuthenticationThrottle"
      WHERE "id" IN (
        SELECT "id"
        FROM "AuthenticationThrottle"
        WHERE "expiresAt" <= CURRENT_TIMESTAMP
        ORDER BY "expiresAt" ASC
        LIMIT ${boundedBatchSize}
      )
    `;
    const challengeCount = await this.database.$executeRaw`
      DELETE FROM "MfaChallenge"
      WHERE "id" IN (
        SELECT "id"
        FROM "MfaChallenge"
        WHERE "expiresAt" <= CURRENT_TIMESTAMP
        ORDER BY "expiresAt" ASC
        LIMIT ${boundedBatchSize}
      )
    `;
    const invitationCount = await this.database.$executeRaw`
      DELETE FROM "PrivilegedInvitation"
      WHERE "id" IN (
        SELECT "id"
        FROM "PrivilegedInvitation"
        WHERE "expiresAt" <= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ORDER BY "expiresAt" ASC
        LIMIT ${boundedBatchSize}
      )
    `;
    return throttleCount + challengeCount + invitationCount;
  }

  private async deliver(event: ClaimedEvent): Promise<void> {
    try {
      const payload = decryptIdentityPayload<IdentityEmailPayload>(
        readEnvelope(event.payload),
      );
      if (
        (payload.template !== "verify-email" &&
          payload.template !== "reset-password" &&
          payload.template !== "privileged-invitation") ||
        typeof payload.to !== "string" ||
        typeof payload.link !== "string"
      ) {
        throw new Error("Invalid identity email payload");
      }
      const rendered = renderIdentityEmail(payload);
      if (!isStagingRecipientAllowed("EMAIL", payload.to)) {
        throw new Error("Staging identity recipient is not allowlisted");
      }
      await this.provider.send({
        to: payload.to,
        ...rendered,
        idempotencyKey: event.eventId,
      });
      await this.database.outboxEvent.updateMany({
        where: { id: event.id, status: "PROCESSING" },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          lockedAt: null,
          lastError: null,
        },
      });
    } catch (error: unknown) {
      const terminal = event.attempts >= 8;
      const delaySeconds = Math.min(3_600, 2 ** Math.min(event.attempts, 10) * 15);
      await this.database.outboxEvent.updateMany({
        where: { id: event.id, status: "PROCESSING" },
        data: {
          status: terminal ? "DEAD_LETTER" : "FAILED",
          availableAt: new Date(Date.now() + delaySeconds * 1_000),
          lockedAt: null,
          lastError: "identity_email_delivery_failed",
        },
      });
      logger.warn(
        { err: error, eventId: event.eventId, attempt: event.attempts, terminal },
        "Identity email delivery failed",
      );
    }
  }
}

async function runIdentityWorker(): Promise<void> {
  assertIdentityWorkerEnvironment();
  const worker = new IdentityOutboxWorker(new ResendEmailProvider());
  let stopping = false;
  process.once("SIGTERM", () => {
    stopping = true;
  });
  process.once("SIGINT", () => {
    stopping = true;
  });

  await prisma.$connect();
  try {
    while (!stopping) {
      const count = await worker.runOnce();
      await worker.cleanupExpiredIdentityState();
      if (count === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await runIdentityWorker();
}
