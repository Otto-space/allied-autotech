import { createHash } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { encryptNotificationPayload } from "../../common/security/mfa-encryption.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { assertNotificationActor } from "./notifications.policy.js";
import { pushSubscriptionSchema } from "./push.schemas.js";

export function pushConfigured() {
  return (
    env.PUSH_DELIVERY_ENABLED &&
    !!env.VAPID_PUBLIC_KEY &&
    !!env.VAPID_PRIVATE_KEY &&
    !!env.VAPID_SUBJECT
  );
}
export class PushService {
  constructor(private readonly database: PrismaClient = prisma) {}
  async status(actor: AuthenticatedActor) {
    assertNotificationActor(actor);
    const active = await this.database.pushSubscription.count({
      where: { userId: actor.userId, sessionId: actor.sessionId, disabledAt: null },
    });
    return {
      available: pushConfigured(),
      publicKey: pushConfigured() ? env.VAPID_PUBLIC_KEY : null,
      enabled: active > 0,
    };
  }
  async subscribe(actor: AuthenticatedActor, body: unknown) {
    assertNotificationActor(actor);
    if (!pushConfigured())
      throw new AppError({
        code: "CONFLICT",
        statusCode: 409,
        message: "Browser notifications are not configured",
      });
    const subscription = pushSubscriptionSchema.parse(body);
    const endpointHash = createHash("sha256").update(subscription.endpoint).digest("hex");
    await this.database.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`push:${endpointHash}`}, 0))`;
      const previous = await tx.pushSubscription.findUnique({ where: { endpointHash } });
      if (previous && previous.userId !== actor.userId)
        throw new AppError({
          code: "CONFLICT",
          statusCode: 409,
          message: "Reset this browser subscription before changing accounts",
        });
      // One browser registration per session. Retired endpoints never receive updates.
      await tx.pushSubscription.updateMany({
        where: {
          userId: actor.userId,
          sessionId: actor.sessionId,
          endpointHash: { not: endpointHash },
          disabledAt: null,
        },
        data: { disabledAt: new Date() },
      });
      const data = {
        sessionId: actor.sessionId,
        encryptedSubscription: encryptNotificationPayload(
          subscription,
        ) as unknown as Prisma.InputJsonValue,
        disabledAt: null,
      };
      await tx.pushSubscription.upsert({
        where: { endpointHash },
        create: { ...data, endpointHash, userId: actor.userId },
        update: data,
      });
    });
    return { enabled: true };
  }
  async unsubscribe(actor: AuthenticatedActor) {
    assertNotificationActor(actor);
    await this.database.pushSubscription.updateMany({
      where: { userId: actor.userId, sessionId: actor.sessionId, disabledAt: null },
      data: { disabledAt: new Date() },
    });
    return { enabled: false };
  }
}
