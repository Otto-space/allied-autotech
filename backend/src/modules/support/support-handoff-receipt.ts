import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  handoffKeySchema,
  handoffReferenceSchema,
  type HandoffReference,
  type HandoffSubmit,
} from "./support-handoff.schemas.js";
import { supportNotFound } from "./support.errors.js";

type Tx = Prisma.TransactionClient;
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const conflict = () =>
  new AppError({
    code: "IDEMPOTENCY_CONFLICT",
    statusCode: 409,
    message: "This handoff operation does not match its original reviewed submission",
  });
async function clock(tx: Tx) {
  const [row] = await tx.$queryRaw<
    { at: Date }[]
  >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "at"`;
  return row!.at;
}
async function ownedReference(tx: Tx, userId: string, value: unknown) {
  const parsed = handoffReferenceSchema.safeParse(value);
  if (!parsed.success) throw supportNotFound();
  const ref = parsed.data;
  const where = { id: ref.id, customer: { userId } };
  const record =
    ref.kind === "ENQUIRY"
      ? await tx.enquiry.findFirst({ where, select: { id: true } })
      : await tx.complaint.findFirst({ where, select: { id: true } });
  if (!record) throw supportNotFound();
  if (
    ref.messageId &&
    !(await tx.supportMessage.findFirst({
      where: {
        id: ref.messageId,
        authorUserId: userId,
        authorType: "CUSTOMER",
        visibility: "CUSTOMER",
        kind: "REPLY",
        ...(ref.kind === "ENQUIRY" ? { enquiryId: ref.id } : { complaintId: ref.id }),
      },
      select: { id: true },
    }))
  )
    throw supportNotFound();
  return ref;
}
async function locate(tx: Tx, userId: string, rawKey: string) {
  const key = handoffKeySchema.parse(rawKey),
    scope = `support-handoff:${userId}`,
    keyHash = digest(key);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ":" + keyHash}, 0))`;
  const at = await clock(tx),
    issuedAt = Number(key.split(".")[1]);
  if (issuedAt > at.getTime() + 60000 || issuedAt + 86400000 <= at.getTime())
    throw new AppError({
      code: "IDEMPOTENCY_EXPIRED",
      statusCode: 409,
      message:
        "The recovery window ended. Check your Customer Care history before creating another request.",
    });
  const prior = await tx.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope, keyHash } },
  });
  return { scope, keyHash, at, issuedAt, prior };
}
export async function readHandoffReceipt(tx: Tx, userId: string, key: string) {
  const { prior } = await locate(tx, userId, key);
  if (
    !prior ||
    prior.userId !== userId ||
    prior.status !== "COMPLETED" ||
    prior.responseStatus !== 201
  )
    throw supportNotFound();
  return {
    reference: await ownedReference(tx, userId, prior.responseBody),
    replayed: true,
    state: "SAVED" as const,
    mode: "QUEUED" as const,
  };
}
export async function withHandoffReceipt(
  tx: Tx,
  userId: string,
  key: string,
  input: HandoffSubmit,
  create: () => Promise<HandoffReference>,
) {
  const { scope, keyHash, at, issuedAt, prior } = await locate(tx, userId, key);
  const requestHash = digest(JSON.stringify(input));
  if (prior) {
    if (
      prior.userId !== userId ||
      prior.requestHash !== requestHash ||
      prior.status !== "COMPLETED" ||
      prior.responseStatus !== 201
    )
      throw conflict();
    return {
      reference: await ownedReference(tx, userId, prior.responseBody),
      replayed: true,
      state: "SAVED" as const,
      mode: "QUEUED" as const,
    };
  }
  const reference = handoffReferenceSchema.parse(await create());
  await tx.idempotencyRecord.create({
    data: {
      userId,
      scope,
      keyHash,
      requestHash,
      status: "COMPLETED",
      responseStatus: 201,
      responseBody: reference,
      completedAt: at,
      expiresAt: new Date(issuedAt + 86400000),
    },
  });
  return { reference, replayed: false, state: "SAVED" as const, mode: "QUEUED" as const };
}
