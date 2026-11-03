import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { aftercareKeySchema } from "./order-aftercare.schemas.js";

const windowMs = 24 * 60 * 60 * 1000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const conflict = () =>
  new AppError({
    statusCode: 409,
    code: errorCodes.idempotencyConflict,
    message: "This request key does not match the original aftercare submission",
  });

/** Ownership must be established before calling; the random key grants no access. */
export async function readAftercareReceipt<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  userId: string | null,
  scope: string,
  key: string,
  readOwned: (id: string) => Promise<T | null>,
) {
  aftercareKeySchema.parse(key);
  const issuedAt = Number(key.split(".")[1]);
  const [clock] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "now"`;
  if (!clock || issuedAt > clock.now.getTime() + 60_000) throw conflict();
  const prior = await tx.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope, keyHash: digest(key) } },
  });
  let record: T | null = null;
  if (prior) {
    if (
      prior.userId !== userId ||
      prior.status !== "COMPLETED" ||
      prior.responseStatus !== 201
    )
      throw conflict();
    const body = prior.responseBody;
    const id =
      body && typeof body === "object" && !Array.isArray(body)
        ? body["resourceId"]
        : undefined;
    record = typeof id === "string" ? await readOwned(id) : null;
    if (!record) throw conflict();
  }
  return {
    found: record !== null,
    record,
    canStartNew: !record && issuedAt + windowMs <= clock.now.getTime(),
    recoveryUntil: new Date(issuedAt + windowMs).toISOString(),
  };
}

export async function aftercareReceipt<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  userId: string | null,
  scope: string,
  key: string,
  normalized: object,
  create: () => Promise<T>,
  readOwned: (id: string) => Promise<T | null>,
): Promise<T & { replayed: boolean }> {
  // Keys are random, non-bearer identifiers; stable hashes survive token-key rotation.
  aftercareKeySchema.parse(key);
  const keyHash = digest(key);
  const requestHash = digest(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(normalized).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  );
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
        "The original submission recovery window has ended; check saved order requests",
    });
  const prior = await tx.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope, keyHash } },
  });
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
