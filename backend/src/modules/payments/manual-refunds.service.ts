import { snapshotRefundClock } from "../policies/refund-clock.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import {
  encryptRefundBeneficiary,
  decryptRefundBeneficiary,
  type EncryptedEnvelope,
} from "../../common/security/mfa-encryption.js";
import {
  issuePaymentEvidenceTicket,
  readPaymentEvidenceTicket,
} from "../../common/security/payment-evidence-tickets.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { objectStorage } from "../../providers/storage/s3-object-storage.adapter.js";
import type { ObjectStoragePort } from "../../providers/storage/object-storage.port.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { assertCapability } from "../policies/policies.service.js";
import { paymentConflict, paymentNotFound, paymentForbidden } from "./payments.errors.js";
import type { PaymentEvidenceUploadInput } from "./payments.schemas.js";
import type { RefundListQuery } from "../audit/audit.schemas.js";
import { refundQueueSelect, refundBeneficiarySchema } from "./refund-record.js";

export class ManualRefundsService {
  constructor(
    private readonly database: PrismaClient = prisma,
    private readonly storage: ObjectStoragePort = objectStorage,
  ) {}

  async list(
    actor: AuthenticatedActor,
    query: RefundListQuery,
    context: RequestSecurityContext,
  ) {
    if (actor.role === "CUSTOMER" || actor.mfaVerifiedAt === null)
      throw paymentForbidden();
    return this.database.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: actor.userId },
        select: {
          role: true,
          status: true,
          emailVerifiedAt: true,
          owner_UserCapability_userId: {
            where: {
              revokedAt: null,
              capability: { in: ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"] },
            },
            select: { capability: true },
          },
        },
      });
      if (
        !user ||
        user.role !== actor.role ||
        user.status !== "ACTIVE" ||
        !user.emailVerifiedAt ||
        !user.owner_UserCapability_userId.length
      )
        throw paymentForbidden();
      const grants = new Set(
        user.owner_UserCapability_userId.map((grant) => grant.capability),
      );
      const scopes: Prisma.RefundWhereInput[] = [];
      if (grants.has("REFUND_APPROVE"))
        scopes.push({
          OR: [{ status: "REQUESTED" }, { approvedByUserId: actor.userId }],
        });
      if (grants.has("REFUND_TRANSFER"))
        scopes.push({
          paymentAttempt: { provider: "MANUAL" },
          authorizationKind: "HUMAN",
          approvedAt: { not: null },
        });
      if (grants.has("REFUND_CHECK"))
        scopes.push({
          paymentAttempt: { provider: "MANUAL" },
          transferredByUserId: { not: null },
        });
      const rows = await tx.refund.findMany({
        where: { OR: scopes, ...(query.status ? { status: query.status } : {}) },
        select: refundQueueSelect,
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "REFUND",
        entityId: null,
        newValues: {
          queue: "DELEGATED_REFUNDS",
          count: Math.min(rows.length, query.limit),
        },
        context,
      });
      return {
        items: rows
          .slice(0, query.limit)
          .map((row) => ({ ...row, amountKobo: row.amountKobo.toString() })),
        ...(rows.length > query.limit ? { nextCursor: rows[query.limit - 1]!.id } : {}),
      };
    });
  }

  async evidenceUpload(
    actor: AuthenticatedActor,
    id: string,
    input: PaymentEvidenceUploadInput,
  ) {
    await assertCapability(this.database, actor, "REFUND_TRANSFER");
    const refund = await this.database.refund.findUnique({
      where: { id },
      include: { paymentAttempt: true },
    });
    if (!refund) throw paymentNotFound();
    if (refund.paymentAttempt.provider !== "MANUAL" || refund.approvedAt === null)
      throw paymentConflict("Only an approved bank refund accepts transfer evidence");
    const issued = issuePaymentEvidenceTicket({
      actorUserId: actor.userId,
      paymentId: id,
      ...input,
    });
    return {
      upload: await this.storage.createUpload({
        key: issued.payload.objectKey,
        ...input,
      }),
      evidenceToken: issued.ticket,
    };
  }

  async recordTransfer(
    actor: AuthenticatedActor,
    id: string,
    input: {
      bankReference: string;
      transferredAt: string;
      evidenceToken: string;
      beneficiary: { bankName: string; accountName: string; accountNumber: string };
    },
    context: RequestSecurityContext,
  ) {
    await assertCapability(this.database, actor, "REFUND_TRANSFER");
    let evidence;
    try {
      evidence = readPaymentEvidenceTicket(input.evidenceToken);
      if (
        evidence.actorUserId !== actor.userId ||
        evidence.paymentId !== id ||
        evidence.expiresAt <= Date.now()
      )
        throw new Error("Invalid ticket");
    } catch {
      throw paymentConflict("Refund evidence token is invalid or expired");
    }
    if (
      !(await this.storage.verifyObject({
        key: evidence.objectKey,
        mimeType: evidence.mimeType,
        sizeBytes: evidence.sizeBytes,
        checksumSha256: evidence.checksumSha256,
      }))
    )
      throw paymentConflict("Transfer evidence upload is incomplete or invalid");
    const transferredAt = new Date(input.transferredAt);
    if (!Number.isFinite(transferredAt.getTime()) || transferredAt > new Date())
      throw paymentConflict("Transfer date must not be in the future");
    return this.database.$transaction(async (tx) => {
      await assertCapability(tx, actor, "REFUND_TRANSFER");
      await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const refund = await tx.refund.findUnique({
        where: { id },
        include: { paymentAttempt: true },
      });
      if (!refund) throw paymentNotFound();
      if (
        refund.paymentAttempt.provider !== "MANUAL" ||
        refund.authorizationKind !== "HUMAN" ||
        !refund.approvedByUserId ||
        !refund.approvedAt
      )
        throw paymentConflict(
          "A reviewed bank refund is required; gateway refunds cannot also be paid by bank",
        );
      if ([refund.requestedByUserId, refund.approvedByUserId].includes(actor.userId))
        throw paymentConflict("A different operator must transfer this refund");
      if (transferredAt < refund.approvedAt)
        throw paymentConflict("Transfer must follow approval");
      if (refund.transferredByUserId) {
        const beneficiary = refund.beneficiaryEncrypted
          ? refundBeneficiarySchema.parse(
              decryptRefundBeneficiary(
                refund.beneficiaryEncrypted as unknown as EncryptedEnvelope,
              ),
            )
          : null;
        if (
          refund.transferredByUserId === actor.userId &&
          refund.bankReference === input.bankReference &&
          refund.bankTransferAt?.getTime() === transferredAt.getTime() &&
          refund.evidenceObjectKey === evidence.objectKey &&
          refund.evidenceSha256 === evidence.checksumSha256 &&
          beneficiary?.bankName === input.beneficiary.bankName &&
          beneficiary?.accountName === input.beneficiary.accountName &&
          beneficiary?.accountNumber === input.beneficiary.accountNumber
        )
          return this.safe(refund);
        throw paymentConflict("Transfer evidence was already recorded");
      }
      if (!["APPROVED", "NEEDS_ATTENTION"].includes(refund.status))
        throw paymentConflict("Refund is not awaiting a bank transfer");
      await tx.$queryRaw`SELECT "id" FROM "PaymentAttempt" WHERE "id" = ${refund.paymentAttemptId}::uuid FOR UPDATE`;
      const committed =
        (
          await tx.refund.aggregate({
            where: {
              paymentAttemptId: refund.paymentAttemptId,
              status: { notIn: ["FAILED", "CANCELLED"] },
            },
            _sum: { amountKobo: true },
          })
        )._sum.amountKobo ?? 0n;
      if (committed > refund.paymentAttempt.amountKobo)
        throw paymentConflict("Refund commitments exceed the captured balance");
      const updated = await tx.refund.update({
        where: { id },
        data: {
          status: "PROCESSING",
          providerStatus: "BANK_TRANSFER_RECORDED",
          transferredByUserId: actor.userId,
          transferRecordedAt: new Date(),
          bankTransferAt: transferredAt,
          bankReference: input.bankReference,
          beneficiaryEncrypted: encryptRefundBeneficiary(
            input.beneficiary,
          ) as unknown as Prisma.InputJsonValue,
          evidenceObjectKey: evidence.objectKey,
          evidenceSha256: evidence.checksumSha256,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "REFUND",
        entityId: id,
        newValues: {
          stage: "TRANSFER_RECORDED",
          evidenceSha256: evidence.checksumSha256,
        },
        context,
      });
      await snapshotRefundClock(tx, id);
      return this.safe(updated);
    });
  }

  async evidenceAccess(
    actor: AuthenticatedActor,
    id: string,
    context: RequestSecurityContext,
  ) {
    await assertCapability(this.database, actor, "REFUND_CHECK");
    const refund = await this.database.refund.findUnique({ where: { id } });
    if (!refund?.evidenceObjectKey) throw paymentNotFound();
    await this.database.$transaction((tx) =>
      appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "REFUND",
        entityId: id,
        newValues: { evidenceAccess: true },
        context,
      }),
    );
    return {
      id: refund.id,
      url: await this.storage.createDownload(refund.evidenceObjectKey, "refund-evidence"),
      beneficiary: refund.beneficiaryEncrypted
        ? decryptRefundBeneficiary(
            refund.beneficiaryEncrypted as unknown as EncryptedEnvelope,
          )
        : null,
      bankReference: refund.bankReference,
      transferredAt: refund.bankTransferAt,
      amountKobo: refund.amountKobo.toString(),
    };
  }

  async check(
    actor: AuthenticatedActor,
    id: string,
    accepted: boolean,
    note: string,
    context: RequestSecurityContext,
  ) {
    await assertCapability(this.database, actor, "REFUND_CHECK");
    return this.database.$transaction(async (tx) => {
      await assertCapability(tx, actor, "REFUND_CHECK");
      await tx.$queryRaw`SELECT "id" FROM "Refund" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const refund = await tx.refund.findUnique({ where: { id } });
      if (!refund) throw paymentNotFound();
      if (
        [
          refund.requestedByUserId,
          refund.approvedByUserId,
          refund.transferredByUserId,
        ].includes(actor.userId)
      )
        throw paymentConflict("An independent checker must verify payment evidence");
      if (
        refund.checkedByUserId === actor.userId &&
        refund.status === "SUCCEEDED" &&
        accepted
      )
        return this.safe(refund);
      if (
        !(
          refund.status === "PROCESSING" ||
          (refund.status === "NEEDS_ATTENTION" &&
            refund.providerStatus === "BANK_TRANSFER_DISPUTED")
        ) ||
        !refund.transferredByUserId ||
        !refund.evidenceObjectKey ||
        !refund.bankReference
      )
        throw paymentConflict("Record transfer evidence before checking completion");
      const now = new Date();
      const updated = await tx.refund.update({
        where: { id },
        data: {
          checkedByUserId: actor.userId,
          checkedAt: now,
          status: accepted ? "SUCCEEDED" : "NEEDS_ATTENTION",
          providerStatus: accepted ? "BANK_TRANSFER_CHECKED" : "BANK_TRANSFER_DISPUTED",
          ...(accepted
            ? { processedAt: now, failureMessage: null }
            : { failureMessage: "Independent checker disputed transfer evidence" }),
        },
      });
      if (accepted)
        await tx.paymentLedgerEntry.upsert({
          where: { sourceKey: `refund:${id}` },
          update: {},
          create: {
            refundId: id,
            sourceKey: `refund:${id}`,
            type: "REFUND",
            direction: "DEBIT",
            amountKobo: refund.amountKobo,
            currency: refund.currency,
            occurredAt: now,
          },
        });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "REFUND",
        entityId: id,
        newValues: { checked: accepted, note },
        context,
      });
      await snapshotRefundClock(tx, id);
      return this.safe(updated);
    });
  }

  private safe(refund: {
    id: string;
    status: string;
    amountKobo: bigint;
    bankReference: string | null;
    checkedAt: Date | null;
    transferredByUserId: string | null;
    bankTransferAt: Date | null;
    checkedByUserId: string | null;
  }) {
    return {
      id: refund.id,
      status: refund.status,
      amountKobo: refund.amountKobo.toString(),
      bankReference: refund.bankReference,
      checkedAt: refund.checkedAt,
      transferredByUserId: refund.transferredByUserId,
      transferredAt: refund.bankTransferAt,
      checkedByUserId: refund.checkedByUserId,
    };
  }
}
