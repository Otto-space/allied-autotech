import { Router } from "express";
import { validate } from "../../common/middleware/validate.js";
import {
  disputeListSchema,
  disputeAssignmentSchema,
  disputeAcknowledgementSchema,
  disputeEvidenceSchema,
  disputeSubmissionSchema,
  disputeActionParams,
  disputeActionBodies,
  disputeRecordSelect,
  disputeRecord,
} from "./disputes.schemas.js";
import { z } from "zod";
import { authenticate } from "../../common/middleware/authenticate.js";
import { requireStaff } from "../../common/middleware/authorize.js";
import { requireCsrf } from "../../common/middleware/csrf.js";
import { successResponse } from "../../common/http/api-response.js";
import { prisma } from "../../config/database.js";
import {
  issuePaymentEvidenceTicket,
  readPaymentEvidenceTicket,
} from "../../common/security/payment-evidence-tickets.js";
import { objectStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { assertCapability } from "../policies/policies.service.js";
import { paymentConflict, paymentForbidden, paymentNotFound } from "./payments.errors.js";
import { paymentEvidenceUploadBodySchema } from "./payments.schemas.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { Prisma } from "../../generated/prisma/client.js";

async function authorized(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  id: string,
) {
  await assertCapability(tx, actor, "DISPUTE_MANAGE");
  const dispute = await tx.paymentDispute.findUnique({ where: { id } });
  if (!dispute) throw paymentNotFound();
  if (
    actor.role === "STAFF" &&
    ![dispute.primaryUserId, dispute.backupUserId].includes(actor.userId)
  )
    throw paymentForbidden();
  return dispute;
}

export function createDisputesRouter() {
  const router = Router();
  router.use(authenticate(), requireStaff);
  router.get("/", validate({ query: disputeListSchema }), async (req, res) => {
    await assertCapability(prisma, req.actor!, "DISPUTE_MANAGE");
    const query = res.locals.validated!["query"] as z.infer<typeof disputeListSchema>;
    const items = await prisma.paymentDispute.findMany({
      where: {
        ...(query.openOnly === "true" ? { resolvedAt: null } : {}),
        ...(req.actor!.role === "STAFF"
          ? {
              OR: [
                { primaryUserId: req.actor!.userId },
                { backupUserId: req.actor!.userId },
              ],
            }
          : {}),
      },
      select: disputeRecordSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    res.json(
      successResponse("Assigned disputes", req.id, {
        items: items.slice(0, query.limit).map(disputeRecord),
        nextCursor: items.length > query.limit ? items[query.limit - 1]!.id : null,
      }),
    );
  });
  router.post(
    "/:id/:action",
    requireCsrf,
    (req, res, next) => {
      const params = disputeActionParams.safeParse(req.params);
      validate({
        params: disputeActionParams,
        ...(params.success ? { body: disputeActionBodies[params.data.action] } : {}),
      })(req, res, next);
    },
    async (req, res) => {
      const { id, action } = res.locals.validated!["params"] as z.infer<
        typeof disputeActionParams
      >;
      const actor = req.actor!;
      const context = {
        requestId: String(req.id),
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      };
      if (action === "evidence-upload") {
        const current = await prisma.$transaction((tx) => authorized(tx, actor, id));
        if (current.resolvedAt || current.evidenceObjectKey)
          throw paymentConflict(
            "Evidence has already been recorded or this dispute is resolved",
          );
        const input = paymentEvidenceUploadBodySchema.parse(req.body);
        const issued = issuePaymentEvidenceTicket({
          actorUserId: actor.userId,
          paymentId: id,
          ...input,
        });
        res.json(
          successResponse("Private dispute evidence upload", req.id, {
            evidenceToken: issued.ticket,
            upload: await objectStorage.createUpload({
              key: issued.payload.objectKey,
              ...input,
            }),
          }),
        );
        return;
      }
      const evidenceInput =
        action === "evidence" ? disputeEvidenceSchema.parse(req.body) : null;
      let evidence: ReturnType<typeof readPaymentEvidenceTicket> | null = null;
      if (evidenceInput) {
        await prisma.$transaction((tx) => authorized(tx, actor, id));
        try {
          evidence = readPaymentEvidenceTicket(evidenceInput.evidenceToken);
        } catch {
          throw paymentConflict("Invalid evidence ticket");
        }
        if (
          evidence.actorUserId !== actor.userId ||
          evidence.paymentId !== id ||
          evidence.expiresAt <= Date.now()
        )
          throw paymentConflict(
            "Evidence ticket is expired or belongs to another action",
          );
        if (
          !(await objectStorage.verifyObject({
            key: evidence.objectKey,
            mimeType: evidence.mimeType,
            sizeBytes: evidence.sizeBytes,
            checksumSha256: evidence.checksumSha256,
          }))
        )
          throw paymentConflict("Evidence upload is incomplete");
      }
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "PaymentDispute" WHERE "id" = ${id}::uuid FOR UPDATE`;
        const dispute = await authorized(tx, actor, id);
        let data: Prisma.PaymentDisputeUncheckedUpdateInput = {};
        if (action === "evidence-access") {
          z.object({}).strict().parse(req.body);
          if (!dispute.evidenceObjectKey) throw paymentNotFound();
          await appendAuditEvent(tx, {
            actorUserId: actor.userId,
            action: "READ",
            entityType: "DISPUTE",
            entityId: id,
            newValues: { evidenceAccess: true },
            context,
          });
          return { id: dispute.id, objectKey: dispute.evidenceObjectKey };
        }
        if (dispute.resolvedAt)
          throw paymentConflict("Resolved dispute history is immutable");
        const expectedUpdatedAt = req.body.expectedUpdatedAt as string | undefined;
        if (
          expectedUpdatedAt &&
          Date.parse(expectedUpdatedAt) !== dispute.updatedAt.getTime()
        )
          throw paymentConflict(
            "This dispute changed; refresh before making another change",
          );
        if (action === "assign") {
          if (actor.role === "STAFF") throw paymentForbidden();
          const input = disputeAssignmentSchema.parse(req.body);
          const users = await tx.user.findMany({
            where: {
              id: { in: [input.primaryUserId, input.backupUserId] },
              role: { not: "CUSTOMER" },
              status: "ACTIVE",
              emailVerifiedAt: { not: null },
            },
            select: { id: true },
          });
          const capabilities = await tx.userCapability.count({
            where: {
              userId: { in: users.map((user) => user.id) },
              capability: "DISPUTE_MANAGE",
              revokedAt: null,
            },
          });
          if (users.length !== 2 || capabilities !== 2)
            throw paymentConflict(
              "Assign two verified active accounts with dispute capability",
            );
          data = { primaryUserId: input.primaryUserId, backupUserId: input.backupUserId };
        } else if (action === "acknowledge") {
          disputeAcknowledgementSchema.parse(req.body);
          if (!dispute.acknowledgedAt)
            data = { acknowledgedAt: new Date(), acknowledgedByUserId: actor.userId };
        } else if (evidence && evidenceInput) {
          if (dispute.evidenceObjectKey)
            throw paymentConflict(
              "Evidence already recorded; preserve the original and attach supplements in the provider dashboard",
            );
          data = {
            evidenceObjectKey: evidence.objectKey,
            evidenceSha256: evidence.checksumSha256,
            evidenceChecklist: {
              invoice: true,
              fulfillmentOrHandoverProof: true,
              relevantCustomerMessages: true,
              note: evidenceInput.note,
            },
          };
        } else if (action === "submission") {
          const input = disputeSubmissionSchema.parse(req.body);
          const at = new Date(input.submittedAt);
          if (!dispute.evidenceObjectKey || at > new Date() || at < dispute.openedAt)
            throw paymentConflict("Record evidence and a valid submission timestamp");
          if (
            dispute.respondedAt &&
            (dispute.providerSubmissionReference !== input.providerSubmissionReference ||
              dispute.respondedAt.getTime() !== at.getTime())
          )
            throw paymentConflict("Submission receipt already recorded");
          // This records staff evidence of dashboard submission; it does not assert provider acceptance or resolve money.
          data = {
            respondedAt: dispute.respondedAt ?? at,
            providerSubmissionReference: input.providerSubmissionReference,
          };
        }
        const updated = await tx.paymentDispute.update({
          where: { id },
          data,
          select: disputeRecordSelect,
        });
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "DISPUTE_UPDATED",
          entityType: "DISPUTE",
          entityId: id,
          newValues: {
            action,
            evidenceSha256: evidence?.checksumSha256 ?? null,
            ...(typeof req.body?.note === "string" ? { note: req.body.note } : {}),
          },
          context,
        });
        return disputeRecord(updated);
      });
      const safeResult =
        "objectKey" in result
          ? {
              id: result.id,
              url: await objectStorage.createDownload(
                result.objectKey,
                "dispute-evidence",
              ),
            }
          : result;
      res.json(successResponse("Dispute action recorded", req.id, safeResult));
    },
  );
  return router;
}
