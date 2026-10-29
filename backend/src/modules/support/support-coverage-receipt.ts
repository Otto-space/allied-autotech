import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import { errorCodes } from "../../common/errors/error-codes.js";
import { locateSupportReceipt } from "./support-creation-receipt.js";
import { supportReplyKeySchema } from "./support.schemas.js";
import {
  supportCoverageSchema,
  supportCoverageUpdateSchema,
} from "./support-live.schemas.js";

type Tx = Prisma.TransactionClient;
type Coverage = z.infer<typeof supportCoverageSchema>;
type Command = z.infer<typeof supportCoverageUpdateSchema>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const scope = (userId: string) => `support-coverage:${userId}`;
const savedReference = z.strictObject({
  resourceId: z.uuid(),
  savedVersion: z.number().int().positive(),
});
const cancelledReference = z.strictObject({
  resourceId: z.uuid(),
  cancelled: z.literal(true),
});
function conflict(): never {
  throw new AppError({
    statusCode: 409,
    code: errorCodes.idempotencyConflict,
    message:
      "This coverage reference does not match the original change or was cancelled. Check the saved action before continuing.",
  });
}
function notFound(): never {
  throw new AppError({
    statusCode: 404,
    code: "NOT_FOUND",
    message: "The coverage operation is unavailable for this branch.",
  });
}
async function locate(tx: Tx, userId: string, branchId: string, rawKey: string) {
  const key = supportReplyKeySchema.parse(rawKey);
  const found = await locateSupportReceipt(tx, scope(userId), key);
  if (!found.prior) return { ...found, state: "UNKNOWN" as const, savedVersion: null };
  const prior = found.prior;
  if (prior.userId !== userId || prior.status !== "COMPLETED") conflict();
  const saved = savedReference.safeParse(prior.responseBody);
  const cancelled = cancelledReference.safeParse(prior.responseBody);
  const reference = saved.success
    ? saved.data
    : cancelled.success
      ? cancelled.data
      : null;
  if (!reference) conflict();
  if (reference.resourceId !== branchId) notFound();
  if (saved.success && prior.responseStatus === 200)
    return { ...found, state: "SAVED" as const, savedVersion: saved.data.savedVersion };
  if (cancelled.success && prior.responseStatus === 409)
    return { ...found, state: "CANCELLED" as const, savedVersion: null };
  return conflict();
}
/** The caller reauthorizes current owner/session/active branch before any receipt access. */
export async function supportCoverageReceipt(
  tx: Tx,
  userId: string,
  branchId: string,
  key: string,
  command: Command,
  save: (value: Command) => Promise<Coverage>,
  current: () => Promise<Coverage>,
) {
  const normalized = {
    ...command,
    schedule: {
      timezone: command.schedule.timezone,
      windows: [...command.schedule.windows].sort(
        (a, b) =>
          a.day - b.day || a.startMinute - b.startMinute || a.endMinute - b.endMinute,
      ),
    },
  };
  const requestHash = hash(JSON.stringify({ branchId, ...normalized }));
  const found = await locate(tx, userId, branchId, key);
  if (found.state === "CANCELLED") conflict();
  if (found.state === "SAVED") {
    if (found.prior!.requestHash !== requestHash) conflict();
    return current();
  }
  const result = await save(normalized);
  await tx.idempotencyRecord.create({
    data: {
      userId,
      scope: scope(userId),
      keyHash: found.keyHash,
      requestHash,
      status: "COMPLETED",
      responseStatus: 200,
      responseBody: { resourceId: branchId, savedVersion: result.version },
      completedAt: found.now,
      expiresAt: new Date(found.issuedAt + 86_400_000),
    },
  });
  return result;
}
export async function supportCoverageOutcome(
  tx: Tx,
  userId: string,
  branchId: string,
  key: string,
  cancel: boolean,
  current: () => Promise<Coverage>,
) {
  const found = await locate(tx, userId, branchId, key);
  const coverage = await current();
  if (found.state === "SAVED")
    return { state: "SAVED" as const, savedVersion: found.savedVersion, coverage };
  if (found.state === "CANCELLED") return { state: "CANCELLED" as const, coverage };
  if (!cancel) return { state: "UNKNOWN" as const, coverage };
  await tx.idempotencyRecord.create({
    data: {
      userId,
      scope: scope(userId),
      keyHash: found.keyHash,
      requestHash: hash(`cancel-coverage:${branchId}`),
      status: "COMPLETED",
      responseStatus: 409,
      responseBody: { resourceId: branchId, cancelled: true },
      completedAt: found.now,
      expiresAt: new Date(found.issuedAt + 86_400_000),
    },
  });
  return { state: "CANCELLED" as const, coverage };
}
