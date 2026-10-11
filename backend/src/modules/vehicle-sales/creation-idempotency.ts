import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { vehicleSaleNotFound } from "./vehicle-sales.errors.js";
import { vehicleSaleFingerprint } from "./vehicle-sales.types.js";

type CreationOperation = "inspection-create" | "vehicle-enquiry-create";

// Only a receipt ID is retained. Replays use the current owner-authorized projection,
// so the idempotency table does not become a second store of customer information.
export async function withCreationIdempotency<T extends { id: string }>(
  transaction: Prisma.TransactionClient,
  userId: string,
  operation: CreationOperation,
  rawKey: string | undefined,
  canonicalInput: unknown,
  create: () => Promise<T>,
  readOwned: (id: string) => Promise<T | null>,
): Promise<T> {
  if (rawKey === undefined) return create();
  const scope = `${operation}:${userId}`;
  const keyHash = hashToken("vehicle-creation-idempotency", rawKey);
  const requestHash = vehicleSaleFingerprint(canonicalInput);
  // The lock, receipt, domain write and audit all commit or roll back together.
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${keyHash}`}, 0))`;
  const prior = await transaction.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope, keyHash } },
  });
  if (prior !== null) {
    if (
      prior.userId !== userId ||
      prior.requestHash !== requestHash ||
      prior.status !== "COMPLETED"
    ) {
      throw new AppError({
        statusCode: 409,
        code: errorCodes.idempotencyConflict,
        message: "The idempotency key conflicts with another request",
      });
    }
    const body = prior.responseBody;
    const id =
      body !== null && typeof body === "object" && !Array.isArray(body)
        ? body["resourceId"]
        : undefined;
    const record = typeof id === "string" ? await readOwned(id) : null;
    if (record === null) throw vehicleSaleNotFound();
    return record;
  }
  const record = await create();
  await transaction.idempotencyRecord.create({
    data: {
      userId,
      scope,
      keyHash,
      requestHash,
      status: "COMPLETED",
      responseStatus: 201,
      responseBody: { resourceId: record.id },
      completedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  return record;
}
