import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import type { PrismaClient } from "../generated/prisma/client.js";
import { prisma } from "../config/database.js";
import { assertIdentityWorkerEnvironment, env } from "../config/env.js";
import {
  decryptIdentityPayload,
  type EncryptedEnvelope,
} from "../common/security/mfa-encryption.js";
import { logger } from "../common/observability/logger.js";
import { AppError } from "../common/errors/app-error.js";
import { isStagingRecipientAllowed } from "../common/security/messaging-recipients.js";
import { renderIdentityEmail } from "../modules/identity/identity-email.templates.js";
import { identityEventTypes } from "../modules/identity/identity.events.js";
import type { IdentityEmailPayload } from "../modules/identity/identity.types.js";
import type { EmailProvider } from "../providers/messaging/email-provider.port.js";
import { ResendEmailProvider } from "../providers/messaging/resend-email.adapter.js";
import { safeErrorAttributes } from "../common/observability/safe-error.js";

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
    private readonly provider: EmailProvider | null,
    private readonly database: PrismaClient = prisma,
  ) {}

  async runOnce(batchSize = 20): Promise<number> {
    if (!this.provider) return 0;
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
      if (!this.provider) throw new Error("Identity delivery is disabled");
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
      const terminal =
        event.attempts >= 8 || (error instanceof AppError && !error.retryable);
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
        {
          ...safeErrorAttributes(error),
          eventId: event.eventId,
          attempt: event.attempts,
          terminal,
        },
        "Identity email delivery failed",
      );
    }
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolveWait) => {
    if (signal.aborted) return resolveWait();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolveWait();
    };
    const timer = setTimeout(finish, milliseconds);
    signal.addEventListener("abort", finish, { once: true });
  });
}

export function identityWorkerBackoff(
  consecutiveFailures: number,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, Math.min(consecutiveFailures - 1, 5));
  const baseMilliseconds = Math.min(30_000, 1_000 * 2 ** exponent);
  const jitterMilliseconds = Math.floor(Math.max(0, Math.min(random(), 1)) * 500);
  return baseMilliseconds + jitterMilliseconds;
}

async function runIdentityWorker(): Promise<void> {
  assertIdentityWorkerEnvironment();
  const worker = new IdentityOutboxWorker(
    env.EMAIL_DELIVERY_ENABLED ? new ResendEmailProvider() : null,
  );
  const stop = new AbortController();
  const stopOnce = () => stop.abort();
  process.once("SIGTERM", stopOnce);
  process.once("SIGINT", stopOnce);
  let consecutiveFailures = 0;

  logger.info("Identity worker starting");
  try {
    while (!stop.signal.aborted) {
      try {
        await prisma.$connect();
        await prisma.workerHeartbeat.upsert({
          where: { name: "identity-outbox" },
          update: { lastStartedAt: new Date() },
          create: { name: "identity-outbox", lastStartedAt: new Date() },
        });
        const count = await worker.runOnce();
        await worker.cleanupExpiredIdentityState();
        await prisma.workerHeartbeat.update({
          where: { name: "identity-outbox" },
          data: { lastSucceededAt: new Date(), errorCode: null },
        });
        consecutiveFailures = 0;
        if (count === 0) await wait(2_000, stop.signal);
      } catch (error: unknown) {
        await prisma.workerHeartbeat
          .updateMany({
            where: { name: "identity-outbox" },
            data: { lastFailedAt: new Date(), errorCode: "WORKER_TASK_FAILED" },
          })
          .catch(() => undefined);
        consecutiveFailures += 1;
        const retryInMilliseconds = identityWorkerBackoff(consecutiveFailures);
        logger.error(
          {
            ...safeErrorAttributes(error),
            consecutiveFailures,
            retryInMilliseconds,
          },
          "Identity worker cycle failed",
        );
        try {
          await prisma.$disconnect();
        } catch (disconnectError: unknown) {
          logger.warn(
            safeErrorAttributes(disconnectError),
            "Identity worker disconnect failed",
          );
        }
        await wait(retryInMilliseconds, stop.signal);
      }
    }
  } finally {
    logger.info("Identity worker stopping");
    try {
      await prisma.$disconnect();
    } catch (error: unknown) {
      logger.warn(safeErrorAttributes(error), "Identity worker final disconnect failed");
    }
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await runIdentityWorker();
}
