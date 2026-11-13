import { databaseClock } from "../../common/database/clock.js";
import { savedSupplyExclusions } from "./order-supply-exception-hold.js";
import { planPickupUnitRanges } from "./order-pickup-units.js";
import { orderCollectionHold, collectionDatabaseClock } from "./order-collection-hold.js";
import { collectionHoldPolicy } from "./order-collection-clock.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type {
  Prisma,
  PrismaClient,
  OrderPickupHandover,
} from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { lockCurrentPaymentCustomer } from "../payments/payments.policy.js";
import { PurchaseGuestAccessService } from "./purchase-guest-access.service.js";
import { assertOrderOperator } from "./orders.policy.js";
import {
  orderConflict,
  orderForbidden,
  orderNotFound,
  orderStale,
} from "./orders.errors.js";
import { orderFingerprint } from "./orders.types.js";
import {
  assertPickupEntitlement,
  createPickupSecret,
  pickupTokenHash,
  pickupLinesSchema,
  planPickupHandover,
} from "./order-pickup.engine.js";
import {
  remainingPickupLines,
  lockPickupOrder,
  originalPickupLines,
  pickupFinancialProof,
  pickupSummary,
  pickupUnitHistory,
  type PickupOrder,
} from "./order-pickup.repository.js";
import {
  pickupIssueSchema,
  pickupRevokeSchema,
  pickupVerifySchema,
  pickupHandoverSchema,
  pickupCancelClaimSchema,
  collectionNoticeSchema,
  collectionExtensionSchema,
} from "./order-pickup.schemas.js";

type Buyer =
  | { kind: "account"; actor: AuthenticatedActor }
  | { kind: "guest"; sessionToken: string; csrfToken?: string };
// Engineering security lifetime, distinct from the owner-approved business hold.
export const pickupSecurityPolicy = {
  version: 1,
  validityMinutes: 1440,
  source: "ENGINEERING_SECURITY_DEFAULT",
} as const;
const receipt = (row: OrderPickupHandover, replayed: boolean) => ({
  id: row.id,
  claimId: row.claimId,
  orderId: row.orderId,
  collectedAt: row.createdAt,
  lines: pickupLinesSchema.parse(row.lines),
  complete: row.completedOrder,
  replayed,
});

export class OrderPickupService {
  private readonly guestAccess: PurchaseGuestAccessService;
  constructor(private readonly database: PrismaClient = prisma) {
    this.guestAccess = new PurchaseGuestAccessService(database);
  }
  private async buyerOrder(
    tx: Prisma.TransactionClient,
    buyer: Buyer,
    id: string,
    write: boolean,
  ) {
    let guestId: string | undefined;
    if (buyer.kind === "account") await lockCurrentPaymentCustomer(tx, buyer.actor);
    else {
      if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw orderForbidden();
      guestId = (
        await this.guestAccess.lockAccess(
          tx,
          buyer.sessionToken,
          write ? { kind: "write", csrfToken: buyer.csrfToken ?? "" } : { kind: "read" },
        )
      ).guestId;
    }
    const order = await lockPickupOrder(tx, id);
    if (
      buyer.kind === "account"
        ? order.customer?.userId !== buyer.actor.userId || order.guestId !== null
        : order.guestId !== guestId || order.customerId !== null
    )
      throw orderNotFound();
    return order;
  }
  private async staffOrder(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
  ) {
    assertOrderOperator(actor);
    await lockAccessActor(tx, actor);
    const order = await lockPickupOrder(tx, id);
    if (actor.role === "STAFF") {
      const staff = await tx.staffProfile.findUnique({
        where: { userId: actor.userId },
        select: { branchId: true, branch: { select: { isActive: true } } },
      });
      if (!staff?.branch?.isActive || staff.branchId !== order.branchId)
        throw orderForbidden();
    }
    return order;
  }
  read(buyer: Buyer, id: string) {
    return withTransactionRetry(
      this.database,
      async (tx) => pickupSummary(tx, await this.buyerOrder(tx, buyer, id, false)),
      { isolationLevel: "Serializable" },
    );
  }
  readStaff(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const order = await this.staffOrder(tx, actor, id);
        const summary = await pickupSummary(tx, order);
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "READ",
          entityType: "ORDER",
          entityId: id,
          newValues: { pickupHistoryRead: true },
          context,
        });
        return summary;
      },
      { isolationLevel: "Serializable" },
    );
  }
  issue(buyer: Buyer, id: string, raw: unknown, context: RequestSecurityContext) {
    const input = pickupIssueSchema.parse(raw),
      requestHash = orderFingerprint({ orderId: id, ...input });
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const order = await this.buyerOrder(tx, buyer, id, true);
        const previous = await tx.orderPickupAuthorisation.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (previous) {
          if (previous.orderId !== id || previous.requestHash !== requestHash)
            throw orderConflict(
              "This pickup request reference was used for different details.",
            );
          return {
            authorisationId: previous.id,
            orderId: id,
            pickupCode: null,
            expiresAt: previous.expiresAt,
            replayed: true,
            securityPolicy: pickupSecurityPolicy,
          };
        }
        if (order.version !== input.expectedVersion) throw orderStale();
        await this.noActiveClaim(tx, id);
        await pickupFinancialProof(tx, order);
        const now = await databaseClock(tx),
          secret = createPickupSecret(
            id,
            now,
            new Date(now.getTime() + pickupSecurityPolicy.validityMinutes * 60000),
          );
        planPickupHandover(
          await remainingPickupLines(tx, order),
          [],
          input.lines,
          input.lines,
        );
        await tx.orderPickupAuthorisation.updateMany({
          where: { orderId: id, revokedAt: null, consumedAt: null },
          data: { revokedAt: await databaseClock(tx), version: { increment: 1 } },
        });
        const authorisation = await tx.orderPickupAuthorisation.create({
          data: {
            orderId: id,
            orderVersion: order.version,
            issuedByUserId: buyer.kind === "account" ? buyer.actor.userId : null,
            issuedByGuestId: buyer.kind === "guest" ? order.guestId : null,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            tokenHash: secret.tokenHash,
            lines: input.lines,
            securityPolicy: pickupSecurityPolicy,
            issuedAt: secret.issuedAt,
            expiresAt: secret.expiresAt,
          },
        });
        await tx.order.update({ where: { id }, data: { version: { increment: 1 } } });
        await appendAuditEvent(tx, {
          actorUserId: buyer.kind === "account" ? buyer.actor.userId : null,
          action: "CREATE",
          entityType: "ORDER",
          entityId: id,
          newValues: {
            pickupAuthorisationId: authorisation.id,
            guestId: order.guestId,
            selectedLineCount: input.lines.length,
            securityPolicyVersion: pickupSecurityPolicy.version,
          },
          context,
        });
        return {
          authorisationId: authorisation.id,
          orderId: id,
          pickupCode: secret.pickupCode,
          expiresAt: secret.expiresAt,
          replayed: false,
          securityPolicy: pickupSecurityPolicy,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
  revoke(buyer: Buyer, id: string, raw: unknown, context: RequestSecurityContext) {
    const input = pickupRevokeSchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const order = await this.buyerOrder(tx, buyer, id, true);
        const authorisation = await tx.orderPickupAuthorisation.findFirst({
          where: { id: input.authorisationId, orderId: id },
        });
        if (!authorisation) throw orderNotFound();
        if (authorisation.revokedAt) return pickupSummary(tx, order);
        if (authorisation.consumedAt)
          throw orderConflict(
            "This authorisation was already used. Review the collection history.",
          );
        if (order.version !== input.expectedVersion) throw orderStale();
        await this.noActiveClaim(tx, id);
        await tx.orderPickupAuthorisation.update({
          where: { id: authorisation.id },
          data: { revokedAt: await databaseClock(tx), version: { increment: 1 } },
        });
        const changed = await tx.order.update({
          where: { id },
          data: { version: { increment: 1 } },
          select: { version: true },
        });
        await appendAuditEvent(tx, {
          actorUserId: buyer.kind === "account" ? buyer.actor.userId : null,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: id,
          newValues: {
            revokedPickupAuthorisationId: authorisation.id,
            reason: input.reason,
            guestId: order.guestId,
          },
          context,
        });
        return pickupSummary(tx, { ...order, version: changed.version });
      },
      { isolationLevel: "Serializable" },
    );
  }
  collectionContact(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = collectionNoticeSchema.parse(raw);
    return this.collectionEvent(actor, id, input, context);
  }
  extendCollectionHold(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = collectionExtensionSchema.parse(raw);
    return this.collectionEvent(actor, id, input, context);
  }
  private collectionEvent(
    actor: AuthenticatedActor,
    id: string,
    input:
      | ReturnType<typeof collectionNoticeSchema.parse>
      | ReturnType<typeof collectionExtensionSchema.parse>,
    context: RequestSecurityContext,
  ) {
    const requestHash = orderFingerprint({ orderId: id, ...input });
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const order = await this.staffOrder(tx, actor, id);
        const previous = await tx.orderCollectionEvent.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (previous) {
          if (previous.orderId !== id || previous.requestHash !== requestHash)
            throw orderConflict(
              "This collection update reference was used for other details.",
            );
          return pickupSummary(tx, order);
        }
        if (order.version !== input.expectedVersion) throw orderStale();
        if (
          order.status !== "READY" ||
          !order.readyAt ||
          order.fulfillmentMethod !== "COLLECTION" ||
          !order.branch?.isActive
        )
          throw orderConflict(
            "Record collection contact only for actual ready collection goods.",
          );
        const holding = await orderCollectionHold(tx, order);
        const extended = "collectByDate" in input;
        if (
          extended &&
          (!holding.noticeId ||
            !holding.collectByDate ||
            input.collectByDate <= holding.collectByDate ||
            new Date(input.collectByDate + "T12:00:00Z").getUTCDay() === 0)
        )
          throw orderConflict(
            "An extension needs actual successful notification and a later Monday-Saturday collection date.",
          );
        const event = await tx.orderCollectionEvent.create({
          data: {
            orderId: id,
            performedByUserId: actor.userId,
            sessionId: actor.sessionId,
            orderVersion: order.version,
            readyAt: order.readyAt,
            kind: extended ? "EXTENDED" : input.outcome,
            method: extended ? null : input.method,
            reason: input.reason,
            noticeId: extended ? holding.noticeId : null,
            previousCollectByDate: extended
              ? new Date(holding.collectByDate! + "T00:00:00Z")
              : null,
            collectByDate: extended ? new Date(input.collectByDate + "T00:00:00Z") : null,
            policySnapshot: collectionHoldPolicy,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            createdAt: await collectionDatabaseClock(tx),
          },
        });
        const changed = await tx.order.update({
          where: { id },
          data: { version: { increment: 1 } },
          select: { version: true },
        });
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: id,
          newValues: {
            collectionEventId: event.id,
            kind: event.kind,
            actualContactResultConfirmed: !extended,
            reason: input.reason,
          },
          context,
        });
        return pickupSummary(tx, { ...order, version: changed.version });
      },
      { isolationLevel: "Serializable" },
    );
  }
  private async noActiveClaim(tx: Prisma.TransactionClient, orderId: string) {
    if (
      await tx.orderPickupClaim.findFirst({
        where: { orderId, cancelledAt: null, consumedAt: null },
        select: { id: true },
      })
    )
      throw orderConflict(
        "A physical pickup review is in progress. Ask the workshop to resolve it before issuing or revoking a code.",
      );
  }
  private async eligible(
    tx: Prisma.TransactionClient,
    order: PickupOrder,
    code: string,
    lines: Parameters<typeof planPickupHandover>[3],
  ) {
    const authorisation = await tx.orderPickupAuthorisation.findFirst({
      where: { orderId: order.id, tokenHash: pickupTokenHash(order.id, code) },
    });
    assertPickupEntitlement(authorisation, order.id, code, await databaseClock(tx));
    const plan = planPickupHandover(
      await remainingPickupLines(tx, order),
      [],
      pickupLinesSchema.parse(authorisation!.lines),
      lines,
    );
    return { authorisation: authorisation!, plan };
  }
  verify(actor: AuthenticatedActor, id: string, raw: unknown) {
    const input = pickupVerifySchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        let order = await this.staffOrder(tx, actor, id);
        const { authorisation, plan } = await this.eligible(
          tx,
          order,
          input.pickupCode,
          input.lines,
        );
        let claim = await tx.orderPickupClaim.findUnique({
          where: { authorisationId: authorisation.id },
        });
        if (claim) {
          if (
            claim.cancelledAt ||
            claim.consumedAt ||
            claim.performedByUserId !== actor.userId ||
            claim.sessionId !== actor.sessionId ||
            orderFingerprint(pickupLinesSchema.parse(claim.selectedLines)) !==
              orderFingerprint(plan.lines)
          )
            throw orderConflict(
              "This pickup authorisation is already under another physical review. Resolve that review before any handover.",
            );
        } else {
          if (order.version !== input.expectedVersion) throw orderStale();
          await this.noActiveClaim(tx, id);
          await pickupFinancialProof(tx, order);
          const changed = await tx.order.update({
            where: { id },
            data: { version: { increment: 1 } },
            select: { version: true },
          });
          order = { ...order, version: changed.version };
          claim = await tx.orderPickupClaim.create({
            data: {
              orderId: id,
              authorisationId: authorisation.id,
              performedByUserId: actor.userId,
              sessionId: actor.sessionId,
              orderVersion: changed.version,
              selectedLines: plan.lines,
            },
          });
        }
        const proof = await pickupFinancialProof(tx, order);
        return {
          orderId: id,
          version: order.version,
          claimId: claim.id,
          authorisationId: authorisation.id,
          expiresAt: authorisation.expiresAt,
          financialReviewHash: orderFingerprint({
            clearance: proof.snapshot,
            claimId: claim.id,
            lines: plan.lines,
          }),
          lines: plan.lines.map((line) => ({
            ...line,
            productName: order.items.find((item) => item.id === line.orderItemId)!
              .productName,
          })),
          completesOrder: plan.complete,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
  cancelClaim(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = pickupCancelClaimSchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const order = await this.staffOrder(tx, actor, id);
        const claim = await tx.orderPickupClaim.findFirst({
          where: { id: input.claimId, orderId: id },
        });
        if (!claim) throw orderNotFound();
        if (
          actor.role === "STAFF" &&
          (claim.performedByUserId !== actor.userId ||
            claim.sessionId !== actor.sessionId)
        )
          throw orderForbidden();
        if (claim.cancelledAt) return pickupSummary(tx, order);
        if (claim.consumedAt)
          throw orderConflict(
            "This review already recorded handover. Preserve its history and contact Customer Care.",
          );
        if (order.version !== input.expectedVersion) throw orderStale();
        const now = await databaseClock(tx);
        await tx.orderPickupClaim.update({
          where: { id: claim.id },
          data: {
            cancelledAt: now,
            cancelledByUserId: actor.userId,
            cancellationReason: input.reason,
          },
        });
        await tx.orderPickupAuthorisation.update({
          where: { id: claim.authorisationId },
          data: { revokedAt: now, version: { increment: 1 } },
        });
        const changed = await tx.order.update({
          where: { id },
          data: { version: { increment: 1 } },
          select: { version: true },
        });
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: id,
          newValues: {
            cancelledPickupReviewId: claim.id,
            goodsNotHandedOverConfirmed: true,
            reason: input.reason,
          },
          context,
        });
        return pickupSummary(tx, { ...order, version: changed.version });
      },
      { isolationLevel: "Serializable" },
    );
  }
  handover(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = pickupHandoverSchema.parse(raw),
      { pickupCode, ...safeInput } = input;
    const requestHash = orderFingerprint({
      orderId: id,
      ...safeInput,
      tokenHash: pickupTokenHash(id, pickupCode),
    });
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const order = await this.staffOrder(tx, actor, id);
        const previous = await tx.orderPickupHandover.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (previous) {
          if (previous.orderId !== id || previous.requestHash !== requestHash)
            throw orderConflict(
              "This handover reference was used for different details.",
            );
          return receipt(previous, true);
        }
        if (order.version !== input.expectedVersion) throw orderStale();
        const { authorisation, plan } = await this.eligible(
          tx,
          order,
          pickupCode,
          input.lines,
        );
        if (authorisation.id !== input.authorisationId)
          throw orderConflict("Review the current private pickup authorisation.");
        const claim = await tx.orderPickupClaim.findFirst({
          where: {
            id: input.claimId,
            orderId: id,
            authorisationId: authorisation.id,
            performedByUserId: actor.userId,
            sessionId: actor.sessionId,
            cancelledAt: null,
            consumedAt: null,
          },
        });
        if (
          !claim ||
          orderFingerprint(pickupLinesSchema.parse(claim.selectedLines)) !==
            orderFingerprint(plan.lines)
        )
          throw orderConflict(
            "Handover must match your exclusive pickup review and its exact goods.",
          );
        const proof = await pickupFinancialProof(tx, order);
        if (
          orderFingerprint({
            clearance: proof.snapshot,
            claimId: claim.id,
            lines: plan.lines,
          }) !== input.financialReviewHash
        )
          throw orderConflict(
            "Financial clearance changed. Verify the current order before handover.",
          );
        const unitRanges = planPickupUnitRanges(
          originalPickupLines(order),
          await pickupUnitHistory(tx, id),
          plan.lines,
          await savedSupplyExclusions(tx, id),
        );
        const now = await databaseClock(tx);
        assertPickupEntitlement(authorisation, id, pickupCode, now);
        await tx.orderPickupClaim.update({
          where: { id: claim.id },
          data: { consumedAt: now },
        });
        const consumed = await tx.orderPickupAuthorisation.updateMany({
          where: {
            id: authorisation.id,
            orderId: id,
            revokedAt: null,
            consumedAt: null,
            expiresAt: { gt: now },
          },
          data: { consumedAt: now, version: { increment: 1 } },
        });
        if (consumed.count !== 1)
          throw orderConflict(
            "Pickup authorisation is no longer available. Review the collection history.",
          );
        const handover = await tx.orderPickupHandover.create({
          data: {
            orderId: id,
            authorisationId: authorisation.id,
            claimId: claim.id,
            performedByUserId: actor.userId,
            orderVersion: order.version,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            lines: plan.lines,
            unitRanges,
            completedOrder: plan.complete,
            collectorName: input.collectorName,
            verificationNote: input.verificationNote,
            financialSnapshot: proof.snapshot,
            createdAt: now,
          },
        });
        await tx.order.update({
          where: { id },
          data: {
            version: { increment: 1 },
            ...(plan.complete ? { status: "COMPLETED", completedAt: now } : {}),
          },
        });
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "UPDATE",
          entityType: "ORDER",
          entityId: id,
          newValues: {
            pickupHandoverId: handover.id,
            selectedLineCount: plan.lines.length,
            completedOrder: plan.complete,
          },
          context,
        });
        return receipt(handover, false);
      },
      { isolationLevel: "Serializable" },
    );
  }
}
