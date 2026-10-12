import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  preferenceRequestKeySchema,
  preferenceUpdateBodySchema,
  type PreferenceUpdateInput,
} from "./notifications.schemas.js";

export const preferenceSelect = {
  category: true,
  channel: true,
  enabled: true,
  consentedAt: true,
  updatedAt: true,
  version: true,
} satisfies Prisma.NotificationPreferenceSelect;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const conflict = () =>
  new AppError({
    statusCode: 409,
    code: "IDEMPOTENCY_CONFLICT",
    message: "The original preference request could not be matched",
  });

export async function writePreferenceReceipt(
  tx: Prisma.TransactionClient,
  userId: string,
  rawKey: string,
  input: PreferenceUpdateInput,
  apply: (normalized: PreferenceUpdateInput) => Promise<{ id: string; version: number }>,
) {
  const key = preferenceRequestKeySchema.parse(rawKey);
  const body = preferenceUpdateBodySchema.parse(input);
  const scope = `notification-preference:${userId}`;
  const keyHash = hash(key);
  const requestHash = hash(
    JSON.stringify([body.category, body.channel, body.enabled, body.expectedVersion]),
  );
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${keyHash}`}, 0))`;
  const observed = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "now"`;
  const now = observed[0]!.now;
  const issuedAt = Number(key.split(".")[1]);
  if (issuedAt > now.getTime() + 60000 || issuedAt + 86400000 <= now.getTime())
    throw new AppError({
      statusCode: 409,
      code: "IDEMPOTENCY_EXPIRED",
      message: "The preference recovery window has ended; refresh current preferences",
    });
  const receipt = await tx.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope, keyHash } },
  });
  if (receipt) {
    if (
      receipt.userId !== userId ||
      receipt.requestHash !== requestHash ||
      receipt.status !== "COMPLETED" ||
      receipt.responseStatus !== 200
    )
      throw conflict();
    const stored = receipt.responseBody;
    if (
      !stored ||
      typeof stored !== "object" ||
      Array.isArray(stored) ||
      typeof stored["resourceId"] !== "string" ||
      typeof stored["appliedVersion"] !== "number" ||
      !Number.isSafeInteger(stored["appliedVersion"]) ||
      stored["appliedVersion"] !== body.expectedVersion + 1
    )
      throw conflict();
    const preference = await tx.notificationPreference.findFirst({
      where: {
        id: stored["resourceId"],
        userId,
        category: body.category,
        channel: body.channel,
      },
      select: preferenceSelect,
    });
    if (!preference || preference.version < stored["appliedVersion"]) throw conflict();
    // Return current state; replay must never reinstate consent withdrawn later.
    return { preference, appliedVersion: stored["appliedVersion"], replayed: true };
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`preference:${userId}:${body.category}:${body.channel}`}, 0))`;
  const existing = await tx.notificationPreference.findUnique({
    where: {
      userId_category_channel: { userId, category: body.category, channel: body.channel },
    },
    select: { version: true },
  });
  if ((existing?.version ?? 0) !== body.expectedVersion)
    throw new AppError({
      statusCode: 409,
      code: "CONFLICT",
      message: "This preference changed; refresh and review the current setting",
    });
  const applied = await apply(body);
  if (applied.version !== body.expectedVersion + 1) throw conflict();
  const preference = await tx.notificationPreference.findFirstOrThrow({
    where: { id: applied.id, userId },
    select: preferenceSelect,
  });
  await tx.idempotencyRecord.create({
    data: {
      userId,
      scope,
      keyHash,
      requestHash,
      status: "COMPLETED",
      responseStatus: 200,
      responseBody: { resourceId: applied.id, appliedVersion: applied.version },
      completedAt: now,
      expiresAt: new Date(issuedAt + 86400000),
    },
  });
  return { preference, appliedVersion: applied.version, replayed: false };
}
