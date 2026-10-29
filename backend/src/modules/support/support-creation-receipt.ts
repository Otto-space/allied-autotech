import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { supportCreationKeySchema, supportReplyKeySchema } from "./support.schemas.js";
import { supportChannelTargetSchema } from "./support-channel.schemas.js";
import type { z } from "zod";

const windowMs = 24 * 60 * 60 * 1000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const conflict = () =>
  new AppError({
    statusCode: 409,
    code: errorCodes.idempotencyConflict,
    message: "This request key does not match the original support submission",
  });

/** Call only inside a transaction after current actor and target authorization. */
export async function locateSupportReceipt(
  tx: Prisma.TransactionClient,
  scope: string,
  key: string,
) {
  const keyHash = digest(key);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${keyHash}`}, 0))`;
  const issuedAt = Number(key.split(".")[1]);
  const observed = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "now"`;
  const now = observed[0]!.now;
  if (issuedAt > now.getTime() + 60_000 || issuedAt + windowMs <= now.getTime())
    throw new AppError({
      statusCode: 409,
      code: errorCodes.idempotencyExpired,
      message:
        "The original submission recovery window has ended; check saved support records",
    });
  const prior = await tx.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope, keyHash } },
  });
  return { keyHash, issuedAt, now, prior };
}
async function supportReceipt<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  userId: string,
  scope: string,
  key: string,
  normalized: object,
  create: () => Promise<T>,
  readOwned: (id: string) => Promise<T | null>,
): Promise<T & { replayed: boolean }> {
  // Keys are random, non-bearer identifiers; stable hashes survive token-key rotation.
  const { keyHash, issuedAt, now, prior } = await locateSupportReceipt(tx, scope, key);
  const requestHash = digest(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
  if (prior) {
    if (
      prior.userId !== userId ||
      prior.requestHash !== requestHash ||
      prior.status !== "COMPLETED" ||
      prior.responseStatus !== 201
    )
      throw conflict();
    const body = prior.responseBody;
    const resourceId =
      body && typeof body === "object" && !Array.isArray(body)
        ? body["resourceId"]
        : undefined;
    const record = typeof resourceId === "string" ? await readOwned(resourceId) : null;
    if (!record) throw conflict(); // Never replace a missing or unauthorized receipt.
    return { ...record, replayed: true };
  }
  const record = await create();
  await tx.idempotencyRecord.create({
    data: {
      userId,
      scope,
      keyHash,
      requestHash,
      status: "COMPLETED",
      responseStatus: 201,
      responseBody: { resourceId: record.id },
      completedAt: now,
      expiresAt: new Date(issuedAt + windowMs),
    },
  });
  return { ...record, replayed: false };
}

/** Reuse canonical reference-only support receipts for channel lifecycle actions. */
export function supportChannelReceipt<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  userId: string,
  action: "request" | "claim" | "transfer" | "end",
  key: string,
  normalized: object,
  create: () => Promise<T>,
  readOwned: (id: string) => Promise<T | null>,
) {
  return supportReceipt(
    tx,
    userId,
    `support-channel:${action}:${userId}`,
    supportReplyKeySchema.parse(key),
    normalized,
    create,
    readOwned,
  );
}

/** Recover only a reference, without retaining a private command body in a browser. */
export async function readSupportChannelReceipt<T>(
  tx: Prisma.TransactionClient,
  userId: string,
  action: "request" | "claim" | "transfer" | "end",
  rawKey: string,
  readAuthorized: (id: string) => Promise<T>,
  readCancelled: (target: z.infer<typeof supportChannelTargetSchema>) => Promise<void>,
) {
  const key = supportReplyKeySchema.parse(rawKey);
  const { prior } = await locateSupportReceipt(
    tx,
    `support-channel:${action}:${userId}`,
    key,
  );
  const body = prior?.responseBody;
  if (
    prior?.userId === userId &&
    prior.status === "COMPLETED" &&
    prior.responseStatus === 409 &&
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    body["cancelled"] === true
  ) {
    const target = supportChannelTargetSchema.safeParse(body["target"]);
    if (target.success) {
      await readCancelled(target.data);
      return { action, state: "CANCELLED" as const, channel: null };
    }
  }
  const id =
    body && typeof body === "object" && !Array.isArray(body) ? body["resourceId"] : null;
  if (
    !prior ||
    prior.userId !== userId ||
    prior.status !== "COMPLETED" ||
    prior.responseStatus !== 201 ||
    typeof id !== "string"
  )
    throw new AppError({
      code: "NOT_FOUND",
      statusCode: 404,
      message:
        "No saved operation reference was found. This does not prove that a pending submission failed.",
    });
  return { action, state: "SAVED" as const, channel: await readAuthorized(id) };
}

/** Serializes with the original command. Cancellation preserves an already saved
 * result; otherwise its durable marker rejects a delayed original submission. */
export async function cancelSupportChannelReceipt<T>(
  tx: Prisma.TransactionClient,
  userId: string,
  action: "request" | "claim" | "transfer" | "end",
  rawKey: string,
  target: z.infer<typeof supportChannelTargetSchema>,
  readAuthorized: (id: string) => Promise<T>,
  readCancelled: (target: z.infer<typeof supportChannelTargetSchema>) => Promise<void>,
) {
  const key = supportReplyKeySchema.parse(rawKey),
    scope = `support-channel:${action}:${userId}`;
  const { prior, now, issuedAt, keyHash } = await locateSupportReceipt(tx, scope, key);
  if (prior)
    return readSupportChannelReceipt(
      tx,
      userId,
      action,
      key,
      readAuthorized,
      readCancelled,
    );
  await tx.idempotencyRecord.create({
    data: {
      userId,
      scope,
      keyHash,
      requestHash: digest("support-channel-cancel-v1:" + JSON.stringify(target)),
      status: "COMPLETED",
      responseStatus: 409,
      responseBody: { cancelled: true, target },
      completedAt: now,
      expiresAt: new Date(issuedAt + windowMs),
    },
  });
  return { action, state: "CANCELLED" as const, channel: null };
}

export function supportCreationReceipt<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: "enquiries" | "complaints",
  rawKey: string,
  normalized: object,
  create: () => Promise<T>,
  readOwned: (id: string) => Promise<T | null>,
) {
  return supportReceipt(
    tx,
    userId,
    `support-create:${kind}:${userId}`,
    supportCreationKeySchema.parse(rawKey),
    normalized,
    create,
    readOwned,
  );
}
export function supportReplyReceipt<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: "enquiry" | "complaint",
  conversationId: string,
  rawKey: string,
  normalized: object,
  create: () => Promise<T>,
  readOwned: (id: string) => Promise<T | null>,
) {
  return supportReceipt(
    tx,
    userId,
    `support-reply:${kind}:${conversationId}:${userId}`,
    supportReplyKeySchema.parse(rawKey),
    normalized,
    create,
    readOwned,
  );
}
