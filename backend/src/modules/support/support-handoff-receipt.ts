import { createHash } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import {
  encryptAssistantContext,
  decryptAssistantContext,
} from "../../common/security/mfa-encryption.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import {
  handoffKeySchema,
  handoffReferenceSchema,
  type HandoffReference,
  type HandoffSubmit,
  handoffDraftSchema,
  handoffPreviewSchema,
  type HandoffDraft,
  type HandoffPreview,
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
async function locate(tx: Tx, userId: string, rawKey: string, allowExpired = false) {
  const key = handoffKeySchema.parse(rawKey),
    scope = `support-handoff:${userId}`,
    keyHash = digest(key);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope + ":" + keyHash}, 0))`;
  const at = await clock(tx),
    issuedAt = Number(key.split(".")[1]);
  if (
    issuedAt > at.getTime() + 60000 ||
    (!allowExpired && issuedAt + 86400000 <= at.getTime())
  )
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
  actor?: AuthenticatedActor,
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
  if (actor) {
    const stored = await readTransientDraft(tx, actor, key);
    if (
      stored &&
      digest(
        JSON.stringify({
          draft: stored.value.draft,
          review: stored.value.preview.review,
          consent: true,
        }),
      ) !== requestHash
    )
      throw conflict();
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

const envelopeSchema = z.strictObject({
  version: z.literal(1),
  keyId: z.string().min(1).max(120),
  iv: z.string().max(32),
  ciphertext: z.string().max(131072),
  tag: z.string().max(32),
});
const storedSchema = z.strictObject({
  draft: handoffDraftSchema,
  preview: handoffPreviewSchema,
});
const draftScope = (actor: AuthenticatedActor) =>
  `support-handoff-draft:${actor.userId}:${actor.sessionId}`;
const draftBinding = (actor: AuthenticatedActor, key: string) =>
  JSON.stringify(["support-handoff-draft:v1", actor.userId, actor.sessionId, key]);
async function readTransientDraft(tx: Tx, actor: AuthenticatedActor, key: string) {
  const row = await tx.idempotencyRecord.findUnique({
    where: { scope_keyHash: { scope: draftScope(actor), keyHash: digest(key) } },
  });
  if (!row || row.userId !== actor.userId || row.status !== "IN_PROGRESS") return null;
  if (row.expiresAt <= (await clock(tx))) throw supportNotFound();
  try {
    const value = storedSchema.parse(
      decryptAssistantContext(
        envelopeSchema.parse(row.responseBody),
        draftBinding(actor, key),
      ),
    );
    return { row, value };
  } catch {
    throw supportNotFound();
  }
}
export async function saveHandoffDraft(
  tx: Tx,
  actor: AuthenticatedActor,
  key: string,
  draft: HandoffDraft,
  preview: HandoffPreview,
) {
  const { prior, at, issuedAt, keyHash } = await locate(tx, actor.userId, key);
  if (prior) throw conflict();
  const existing = await readTransientDraft(tx, actor, key);
  if (existing) {
    if (
      JSON.stringify(existing.value.draft) !== JSON.stringify(draft) ||
      JSON.stringify(existing.value.preview.target) !== JSON.stringify(preview.target) ||
      existing.value.preview.body !== preview.body
    )
      throw conflict();
    return existing.value.preview;
  }
  if (
    (await tx.idempotencyRecord.count({
      where: {
        userId: actor.userId,
        scope: draftScope(actor),
        status: "IN_PROGRESS",
        expiresAt: { gt: at },
      },
    })) >= 3
  )
    throw new AppError({
      code: "RATE_LIMITED",
      statusCode: 429,
      message: "Finish or cancel an earlier handoff review before preparing another.",
    });
  const expiresAt = new Date(Math.min(at.getTime() + 15 * 60000, issuedAt + 86400000));
  const result = handoffPreviewSchema.parse({
    ...preview,
    recoveryExpiresAt: expiresAt.toISOString(),
  });
  await tx.idempotencyRecord.create({
    data: {
      userId: actor.userId,
      scope: draftScope(actor),
      keyHash,
      requestHash: digest(JSON.stringify(draft)),
      status: "IN_PROGRESS",
      responseBody: {
        ...encryptAssistantContext({ draft, preview: result }, draftBinding(actor, key)),
      },
      expiresAt,
    },
  });
  return result;
}
export async function forgetHandoffDraft(tx: Tx, actor: AuthenticatedActor, key: string) {
  // Only this session's unsubmitted transient draft. Never deletes a case or receipt.
  await tx.idempotencyRecord.deleteMany({
    where: {
      userId: actor.userId,
      scope: draftScope(actor),
      keyHash: digest(key),
      status: "IN_PROGRESS",
    },
  });
}
export async function recoverHandoffDraft(
  tx: Tx,
  actor: AuthenticatedActor,
  key: string,
) {
  const { prior } = await locate(tx, actor.userId, key);
  if (prior?.status === "COMPLETED")
    return { saved: await readHandoffReceipt(tx, actor.userId, key) };
  if (prior?.status === "FAILED") return { cancelled: true as const };
  const stored = await readTransientDraft(tx, actor, key);
  if (!stored) throw supportNotFound();
  return { stored };
}
export async function cancelHandoffOperation(
  tx: Tx,
  actor: AuthenticatedActor,
  key: string,
) {
  const { scope, keyHash, at, issuedAt, prior } = await locate(
    tx,
    actor.userId,
    key,
    true,
  );
  if (prior?.status === "COMPLETED") {
    if (prior.userId !== actor.userId || prior.responseStatus !== 201)
      throw supportNotFound();
    return {
      reference: await ownedReference(tx, actor.userId, prior.responseBody),
      replayed: true,
      state: "SAVED" as const,
      mode: "QUEUED" as const,
    };
  }
  // An expired operation is already forbidden from writing. Clear its session draft
  // without allocating a new receipt or extending any retention/write deadline.
  if (!prior && issuedAt + 86400000 > at.getTime())
    await tx.idempotencyRecord.create({
      data: {
        userId: actor.userId,
        scope,
        keyHash,
        requestHash: digest("cancelled:" + key),
        status: "FAILED",
        responseStatus: 409,
        completedAt: at,
        expiresAt: new Date(issuedAt + 86400000),
      },
    });
  await forgetHandoffDraft(tx, actor, key);
  return { state: "CANCELLED" as const, cancelled: true as const };
}
