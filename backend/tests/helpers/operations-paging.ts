import { randomUUID } from "node:crypto";
import { prisma } from "../../src/config/database.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/common/security/session-tokens.js";
import { sessionCookieName } from "../../src/common/security/cookies.js";
import { sessionWindow } from "./session-window.js";
import { testOwner } from "./owner.js";
export async function operationsAccount(
  role: "ADMIN" | "SUPER_ADMIN" | "STAFF" | "CUSTOMER" = "ADMIN",
  assured = true,
) {
  const user =
    role === "SUPER_ADMIN"
      ? await testOwner("unusable-synthetic")
      : await prisma.user.create({
          data: {
            email: `ops-paging-${randomUUID()}@example.test`,
            passwordHash: "unusable-synthetic",
            role,
            emailVerifiedAt: new Date(),
          },
        });
  const token = generateOpaqueToken(),
    csrf = generateOpaqueToken();
  const session = await prisma.session.create({
    data: {
      createdAt: new Date(Date.now() - 1000),
      userId: user.id,
      tokenHash: hashToken("session", token),
      csrfTokenHash: hashToken("csrf", csrf),
      ...sessionWindow(3600000),
      mfaRequired: role !== "CUSTOMER",
      mfaVerifiedAt: assured && role !== "CUSTOMER" ? new Date() : null,
    },
  });
  return {
    user,
    token,
    csrf,
    session,
    headers: {
      Cookie: `${sessionCookieName}=${token}`,
      Origin: "http://localhost:3000",
      "X-CSRF-Token": csrf,
    },
  };
}
export async function operationsJob(
  source: "OUTBOX" | "PAYMENT_WEBHOOK",
  id = randomUUID(),
  at = new Date(Date.now() - 60000),
  status: "FAILED" | "DEAD_LETTER" | "PROCESSING" = "FAILED",
) {
  const common = {
    id,
    status,
    lockedAt: status === "PROCESSING" ? at : null,
    updatedAt: at,
    eventType: `synthetic.ops.${source.toLowerCase()}`,
  };
  if (source === "OUTBOX")
    return {
      source,
      ...(await prisma.outboxEvent.create({
        data: {
          ...common,
          eventId: randomUUID(),
          aggregateType: "SyntheticOpsPaging",
          aggregateId: randomUUID(),
          payload: { privateCanary: "PRIVATE-QUEUE-PAYLOAD" },
          attempts: 3,
          availableAt: at,
          lastError: "SYNTHETIC_FAILURE",
        },
      })),
    };
  return {
    source,
    ...(await prisma.paymentWebhookEvent.create({
      data: {
        ...common,
        provider: "PAYSTACK",
        deduplicationKey: randomUUID().replaceAll("-", "").padEnd(64, "0"),
        payloadSha256: "a".repeat(64),
        redactedPayload: { privateCanary: "PRIVATE-WEBHOOK-PAYLOAD" },
        processingAttempts: 3,
        lastErrorCode: "SYNTHETIC_FAILURE",
        lastErrorMessage: "Synthetic processing error",
        receivedAt: at,
        signatureVerifiedAt: at,
        failedAt: status === "PROCESSING" ? null : at,
      },
    })),
  };
}
