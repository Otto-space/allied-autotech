import { enqueueNotification } from "../notifications/notifications.service.js";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import type { PrismaClient, PartsQuote } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { hashToken } from "../../common/security/session-tokens.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { assertReviewModerator } from "../support/support.policy.js";
import {
  supportConflict,
  supportNotFound,
  supportStale,
} from "../support/support.errors.js";
import { assertFinanceGate, policySnapshot } from "../policies/policies.service.js";
import { draftTotals } from "../policies/policy-money.js";
import { jsonSafe, orderFingerprint } from "./orders.types.js";

export const issuePartsQuoteSchema = z
  .object({
    expectedRevision: z.number().int().min(0).max(2147483646),
    productId: z.uuid(),
    quantity: z.number().int().min(1).max(100),
    unitPriceKobo: z.string().regex(/^[1-9][0-9]{0,12}$/),
    notes: z.string().trim().min(10).max(2000),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const partsQuoteDecisionSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();
export function partsQuoteView(quote: PartsQuote) {
  const {
    idempotencyKeyHash: _key,
    requestHash: _hash,
    createdByUserId: _creator,
    policySnapshot: _policy,
    ...view
  } = quote;
  return jsonSafe({
    ...view,
    status:
      quote.status === "ISSUED" && quote.expiresAt <= new Date()
        ? "EXPIRED"
        : quote.status,
  });
}
export class PartsQuotesService {
  constructor(private readonly database: PrismaClient = prisma) {}
  async list(
    actor: AuthenticatedActor,
    enquiryId: string,
    context: RequestSecurityContext,
  ) {
    const enquiry = await this.database.enquiry.findUnique({
      where: { id: enquiryId },
      include: { customer: { select: { userId: true } } },
    });
    if (!enquiry || enquiry.type !== "PRODUCT") throw supportNotFound();
    if (actor.role === "CUSTOMER") {
      if (enquiry.customer?.userId !== actor.userId) throw supportNotFound();
    } else assertReviewModerator(actor);
    const items = await this.database.partsQuote.findMany({
      where: { enquiryId },
      orderBy: { revision: "desc" },
      take: 100,
    });
    if (actor.role !== "CUSTOMER") {
      await this.database.$transaction((transaction) =>
        appendAuditEvent(transaction, {
          actorUserId: actor.userId,
          action: "READ",
          entityType: "ENQUIRY",
          entityId: enquiryId,
          newValues: { privilegedRead: true, resource: "partsQuotations" },
          context,
        }),
      );
    }
    return { items: items.map(partsQuoteView) };
  }
  async issue(
    actor: AuthenticatedActor,
    enquiryId: string,
    raw: z.infer<typeof issuePartsQuoteSchema>,
    key: string,
    context: RequestSecurityContext,
  ) {
    assertReviewModerator(actor);
    const input = issuePartsQuoteSchema.parse(raw);
    const keyHash = hashToken("parts-quote-issue", `${actor.userId}:${key}`);
    const requestHash = orderFingerprint({ enquiryId, ...input });
    return withTransactionRetry(this.database, async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`parts-quote-key:${keyHash}`}, 0))`;
      const replay = await tx.partsQuote.findUnique({
        where: { idempotencyKeyHash: keyHash },
      });
      if (replay) {
        if (replay.requestHash !== requestHash)
          throw supportConflict(
            "This submission key was used for different quotation details",
          );
        return partsQuoteView(replay);
      }
      await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id" = ${enquiryId}::uuid FOR UPDATE`;
      const enquiry = await tx.enquiry.findUnique({
        where: { id: enquiryId },
        include: { branch: true, customer: { select: { userId: true } } },
      });
      if (!enquiry || enquiry.type !== "PRODUCT") throw supportNotFound();
      if (!enquiry.customerId || !enquiry.branch?.isActive || enquiry.status === "CLOSED")
        throw supportConflict(
          "A quotation needs an open customer-owned parts request and an active collection branch",
        );
      const latest = await tx.partsQuote.findFirst({
        where: { enquiryId },
        orderBy: { revision: "desc" },
      });
      if ((latest?.revision ?? 0) !== input.expectedRevision) throw supportStale();
      if (latest?.status === "ACCEPTED")
        throw supportConflict(
          "An accepted quotation cannot be replaced; use the linked order and aftercare process",
        );
      const expiresAt = new Date(input.expiresAt);
      if (expiresAt <= new Date() || expiresAt.getTime() > Date.now() + 30 * 86400000)
        throw supportConflict("Choose an expiry within the next 30 days");
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        include: { category: { include: { parent: true } } },
      });
      if (
        !product?.isActive ||
        product.currency !== "NGN" ||
        !product.category.isActive ||
        (product.category.parentId && !product.category.parent?.isActive)
      )
        throw supportConflict(
          "Select the actual active catalogue product identified during assessment",
        );
      const finance = await assertFinanceGate(tx);
      const subtotalKobo = BigInt(input.unitPriceKobo) * BigInt(input.quantity);
      const { taxKobo } = draftTotals(subtotalKobo, 0n);
      await tx.partsQuote.updateMany({
        where: { enquiryId, status: "ISSUED" },
        data: { status: "VOID", decidedAt: new Date() },
      });
      const quote = await tx.partsQuote.create({
        data: {
          enquiryId,
          productId: product.id,
          createdByUserId: actor.userId,
          revision: input.expectedRevision + 1,
          productName: product.name,
          sku: product.sku,
          quantity: input.quantity,
          unitPriceKobo: BigInt(input.unitPriceKobo),
          subtotalKobo,
          taxKobo,
          totalKobo: subtotalKobo + taxKobo,
          notes: input.notes,
          expiresAt,
          idempotencyKeyHash: keyHash,
          requestHash,
          policySnapshot: {
            finance: policySnapshot(finance),
            branchId: enquiry.branchId,
            fulfillmentMethod: "COLLECTION",
          },
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "ENQUIRY",
        entityId: quote.enquiryId,
        newValues: {
          enquiryId,
          revision: quote.revision,
          totalKobo: quote.totalKobo.toString(),
        },
        context,
      });
      await enqueueNotification(tx, {
        userId: enquiry.customer!.userId,
        type: "ENQUIRY",
        category: "TRANSACTIONAL",
        title: "Your parts quotation is ready",
        message:
          "Review the new quotation in your parts request. No payment or order has been confirmed.",
        resourceType: "ENQUIRY",
        resourceId: enquiryId,
        deduplicationKey: `parts-quote:${quote.id}:issued`,
        channels: ["EMAIL"],
      });
      return partsQuoteView(quote);
    });
  }
  async decline(
    actor: AuthenticatedActor,
    id: string,
    revision: number,
    context: RequestSecurityContext,
  ) {
    return withTransactionRetry(this.database, async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PartsQuote" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const quote = await tx.partsQuote.findUnique({
        where: { id },
        include: { enquiry: { include: { customer: { select: { userId: true } } } } },
      });
      if (
        !quote ||
        actor.role !== "CUSTOMER" ||
        quote.enquiry.customer?.userId !== actor.userId
      )
        throw supportNotFound();
      if (quote.revision !== revision) throw supportStale();
      if (quote.status === "REJECTED") return partsQuoteView(quote);
      if (quote.status !== "ISSUED" || quote.expiresAt <= new Date())
        throw supportConflict("This quotation is no longer available for a decision");
      const updated = await tx.partsQuote.update({
        where: { id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "STATUS_CHANGE",
        entityType: "ENQUIRY",
        entityId: quote.enquiryId,
        newValues: { status: "REJECTED", revision },
        context,
      });
      return partsQuoteView(updated);
    });
  }
}
export const partsQuotesService = new PartsQuotesService();
