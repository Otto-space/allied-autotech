import { timingSafeEqual } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { hashToken } from "../../common/security/session-tokens.js";
import {
  isTransactionConflict,
  withTransactionRetry,
} from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  customerHandoffExcerpts,
  finishCustomerHandoffContext,
} from "../learning/allie.conversations.js";
import { learningAccessInTransaction } from "../learning/learning.service.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import { enqueueDepartmentEmail } from "./department-email.js";
import { assertSupportCustomer } from "./support.policy.js";
import {
  supportBranchRequired,
  supportConflict,
  supportNotFound,
} from "./support.errors.js";
import { SupportRepository } from "./support.repository.js";
import {
  handoffDraftSchema,
  handoffSubmitSchema,
  handoffPreviewSchema,
  type HandoffDraft,
  type HandoffSubmit,
} from "./support-handoff.schemas.js";
import {
  readHandoffReceipt,
  withHandoffReceipt,
  saveHandoffDraft,
  forgetHandoffDraft,
  recoverHandoffDraft,
  cancelHandoffOperation,
} from "./support-handoff-receipt.js";

type Tx = Prisma.TransactionClient;
const repository = new SupportRepository();
const stale = () =>
  new AppError({
    code: "STALE_VERSION",
    statusCode: 409,
    message:
      "The handoff changed or review expired. Review the exact message again before sending.",
  });
async function customer(tx: Tx, actor: AuthenticatedActor) {
  assertSupportCustomer(actor);
  const access = await learningAccessInTransaction(tx, actor);
  if (!access.verified) throw supportNotFound();
  const value = await repository.customer(actor.userId, tx);
  if (!value) throw supportNotFound();
  return value;
}
async function draftTarget(tx: Tx, customerId: string, target: HandoffDraft["target"]) {
  if (target.kind === "NEW_ENQUIRY") {
    const branches = target.branchId
      ? await tx.branch.findMany({
          where: { id: target.branchId, isActive: true },
          select: { id: true, name: true },
          take: 1,
        })
      : await tx.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { id: "asc" },
          take: 2,
        });
    if (!branches.length) throw supportNotFound();
    if (branches.length > 1) throw supportBranchRequired();
    const branch = branches[0]!;
    return {
      kind: target.kind,
      id: null,
      branchId: branch.id,
      branchName: branch.name,
      subject: target.subject,
      version: null,
    };
  }
  const kind = target.kind === "ENQUIRY" ? "enquiry" : "complaint";
  const locked = await repository.lockCustomerThread(customerId, kind, target.id, tx);
  if (!locked) throw supportNotFound();
  const fields = { branchId: true, version: true, status: true, subject: true } as const;
  const record =
    target.kind === "ENQUIRY"
      ? await tx.enquiry.findFirst({
          where: { id: target.id, customerId },
          select: fields,
        })
      : await tx.complaint.findFirst({
          where: { id: target.id, customerId },
          select: fields,
        });
  if (!record?.branchId) throw supportNotFound();
  if (record.version !== target.expectedVersion) throw stale();
  if (record.status === "CLOSED")
    throw supportConflict(
      "Closed cases cannot receive a handoff. Choose a new enquiry instead.",
    );
  const branch = await tx.branch.findFirst({
    where: { id: record.branchId, isActive: true },
    select: { id: true, name: true },
  });
  if (!branch) throw supportNotFound();
  return {
    kind: target.kind,
    id: target.id,
    branchId: branch.id,
    branchName: branch.name,
    subject: record.subject,
    version: record.version,
  };
}
async function prepare(
  tx: Tx,
  actor: AuthenticatedActor,
  customerId: string,
  input: HandoffDraft,
) {
  const target = await draftTarget(tx, customerId, input.target);
  const excerpts = input.excerpts
    ? await customerHandoffExcerpts(tx, actor, input.excerpts)
    : [];
  const body = [
    "Customer Care handoff — reviewed by the customer",
    "Issue summary (customer editable):",
    input.summary,
    ...(excerpts.length
      ? [
          "Selected help excerpts (shared with permission; AI guidance is not verified case evidence):",
          ...excerpts,
        ]
      : []),
  ].join("\n\n");
  if (body.length > 4000)
    throw new AppError({
      code: "VALIDATION_FAILED",
      statusCode: 422,
      message:
        "The reviewed message is too long. Shorten the summary or share fewer excerpts.",
    });
  return {
    target,
    body,
    audience: "CUSTOMER_CARE" as const,
    mode: "QUEUED" as const,
    excerptCount: excerpts.length,
  };
}
function token(
  actor: AuthenticatedActor,
  draft: HandoffDraft,
  prepared: Awaited<ReturnType<typeof prepare>>,
  expiresAt: string,
) {
  return hashToken(
    "assistant-handoff-review",
    JSON.stringify([actor.userId, actor.sessionId, draft, prepared, expiresAt]),
  );
}
export async function previewCustomerHandoff(
  actor: AuthenticatedActor,
  raw: HandoffDraft,
  operationKey?: string,
) {
  const draft = handoffDraftSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const account = await customer(tx, actor),
      prepared = await prepare(tx, actor, account.id, draft);
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();
    const result = handoffPreviewSchema.parse({
      ...prepared,
      review: { expiresAt, token: token(actor, draft, prepared, expiresAt) },
    });
    return operationKey
      ? saveHandoffDraft(tx, actor, operationKey, draft, result)
      : result;
  });
}
export async function submitCustomerHandoff(
  actor: AuthenticatedActor,
  raw: HandoffSubmit,
  key: string,
  context: RequestSecurityContext,
) {
  const input = handoffSubmitSchema.parse(raw);
  return withTransactionRetry(
    prisma,
    async (tx) => {
      const account = await customer(tx, actor);
      const saved = await withHandoffReceipt(
        tx,
        actor.userId,
        key,
        input,
        async () => {
          const prepared = await prepare(tx, actor, account.id, input.draft);
          const [clock] = await tx.$queryRaw<
            { at: Date }[]
          >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "at"`;
          const expiry = Date.parse(input.review.expiresAt);
          if (
            expiry <= clock!.at.getTime() ||
            expiry > clock!.at.getTime() + 10 * 60000 + 60000 ||
            !timingSafeEqual(
              Buffer.from(input.review.token, "hex"),
              Buffer.from(
                token(actor, input.draft, prepared, input.review.expiresAt),
                "hex",
              ),
            )
          )
            throw stale();
          const { target, body } = prepared;
          let id: string,
            messageId: string | null = null;
          if (target.kind === "NEW_ENQUIRY") {
            const record = await repository.createCustomerEnquiry(
              account,
              {
                type: "GENERAL",
                branchId: target.branchId,
                subject: target.subject,
                message: body,
              },
              target.branchId,
              tx,
            );
            if (!record) throw supportNotFound();
            id = record.id;
            await enqueueDepartmentEmail(tx, {
              id,
              type: "GENERAL",
              subject: target.subject,
              message: body,
              email: account.user.email,
            });
          } else {
            id = target.id!;
            const changed =
              target.kind === "ENQUIRY"
                ? await tx.enquiry.updateMany({
                    where: {
                      id,
                      version: target.version!,
                      customerId: account.id,
                      status: { not: "CLOSED" },
                    },
                    data: { version: { increment: 1 } },
                  })
                : await tx.complaint.updateMany({
                    where: {
                      id,
                      version: target.version!,
                      customerId: account.id,
                      status: { not: "CLOSED" },
                    },
                    data: { version: { increment: 1 } },
                  });
            if (changed.count !== 1) throw stale();
            const message = await repository.createMessage(
              target.kind === "ENQUIRY" ? { enquiryId: id } : { complaintId: id },
              actor.userId,
              "CUSTOMER",
              "CUSTOMER",
              body,
              tx,
            );
            messageId = message.id;
          }
          const kind =
            target.kind === "COMPLAINT" ? ("COMPLAINT" as const) : ("ENQUIRY" as const);
          await appendAuditEvent(tx, {
            actorUserId: actor.userId,
            action: "CREATE",
            entityType: kind,
            entityId: id,
            newValues: {
              source: "REVIEWED_ALLIE_HANDOFF",
              excerptCount: prepared.excerptCount,
              ...(messageId ? { messageId } : {}),
              branchId: target.branchId,
            },
            context,
          });
          await notifySupportTeam(tx, {
            kind,
            id,
            event: messageId ? `reply:${messageId}` : `new:${id}`,
            title: messageId ? "New customer reply" : "New customer enquiry",
            actorUserId: actor.userId,
            ...(messageId ? { supportMessageId: messageId } : {}),
          });
          if (input.draft.excerpts)
            await finishCustomerHandoffContext(tx, actor, input.draft.excerpts);
          await customer(tx, actor); // Recheck natural expiry before committing.
          return {
            kind,
            id,
            branchId: target.branchId,
            messageId,
            createdNew: target.kind === "NEW_ENQUIRY",
          };
        },
        actor,
      );
      await forgetHandoffDraft(tx, actor, key);
      return saved;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxAttempts: 5 },
  ).catch((error: unknown) => {
    if (!isTransactionConflict(error)) throw error;
    throw new AppError({
      code: "DATABASE_UNAVAILABLE",
      statusCode: 503,
      message:
        "Your message could not be completed right now. Check your handoff before retrying the same reviewed message.",
      retryable: true,
      cause: error,
    });
  });
}
export async function customerHandoffReceipt(actor: AuthenticatedActor, key: string) {
  return prisma.$transaction(async (tx) => {
    await customer(tx, actor);
    return readHandoffReceipt(tx, actor.userId, key);
  });
}
export async function recoverCustomerHandoff(actor: AuthenticatedActor, key: string) {
  return prisma.$transaction(async (tx) => {
    const account = await customer(tx, actor),
      result = await recoverHandoffDraft(tx, actor, key);
    if (result.saved) return result.saved;
    if (result.cancelled)
      return { state: "CANCELLED" as const, cancelled: true as const };
    const { row, value } = result.stored;
    try {
      const current = await prepare(tx, actor, account.id, value.draft);
      const { review, recoveryExpiresAt: _expires, ...original } = value.preview;
      if (
        JSON.stringify(current) !== JSON.stringify(original) ||
        Date.parse(review.expiresAt) <= Date.now()
      )
        throw stale();
      return {
        state: "REVIEW" as const,
        draft: value.draft,
        preview: value.preview,
        expiresAt: row.expiresAt.toISOString(),
      };
    } catch (error) {
      if (!(error instanceof AppError) || ![404, 409].includes(error.statusCode))
        throw error;
      // Retain the customer's own editable input; never return stale help text or
      // private target facts after revalidation fails. Cancel the old operation
      // before creating a fresh review, preventing late writes on the old key.
      const { excerpts: _excerpts, ...draft } = value.draft;
      return {
        state: "NEEDS_REVIEW" as const,
        draft,
        preview: null,
        expiresAt: row.expiresAt.toISOString(),
        excerptsCleared: !!value.draft.excerpts,
      };
    }
  });
}
export async function cancelCustomerHandoff(actor: AuthenticatedActor, key: string) {
  return prisma.$transaction(async (tx) => {
    await customer(tx, actor);
    return cancelHandoffOperation(tx, actor, key);
  });
}
