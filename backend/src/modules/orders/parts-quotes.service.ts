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
import { quotationTerms } from "../policies/quotation-terms.js";
import { normalizeEmail } from "../../common/security/email.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { enqueueSupportCustomerUpdate } from "../support/customer-email.js";
import { PurchaseGuestAccessService } from "./purchase-guest-access.service.js";
import { env } from "../../config/env.js";
import { productPurchasesEnabled } from "../../common/contracts/public-release.js";
import { purchaseQuoteListSchema } from "./purchase.schemas.js";
import { jsonSafe, orderFingerprint } from "./orders.types.js";

export const issuePartsQuoteSchema = z
  .object({
    expectedRevision: z.number().int().min(0).max(2147483646),
    productId: z.uuid(),
    quantity: z.number().int().min(1).max(100),
    unitPriceKobo: z.string().regex(/^[1-9][0-9]{0,12}$/),
    notes: z.string().trim().min(10).max(2000),
    expiresAt: z.iso
      .datetime({ offset: true })
      .optional()
      .describe(
        "Legacy field retained only for original-key receipt recovery. New issuance requests must omit it; custom expiry is rejected. The server sets the approved seven-day validity from issuance.",
      ),
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
    guestEmail: _guestRecipient,
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
      await lockAccessActor(tx, actor);
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
      if (input.expiresAt !== undefined)
        throw supportConflict(
          "Quotations are valid for 7 days from issue. Refresh the form to use the current quotation terms.",
        );
      await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id" = ${enquiryId}::uuid FOR UPDATE`;
      const enquiry = await tx.enquiry.findUnique({
        where: { id: enquiryId },
        include: { branch: true, customer: { select: { userId: true } } },
      });
      if (!enquiry || enquiry.type !== "PRODUCT") throw supportNotFound();
      if (!enquiry.branch?.isActive || enquiry.status === "CLOSED")
        throw supportConflict(
          "A quotation needs an open parts request and an active collection branch",
        );
      const guestEmail =
        enquiry.customerId === null ? normalizeEmail(enquiry.email ?? "") : null;
      if (guestEmail !== null && !z.email().max(254).safeParse(guestEmail).success)
        throw supportConflict(
          "Add a valid recipient email to this parts request before issuing a guest quotation",
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
      const terms = await quotationTerms(tx);
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
          guestEmail,
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
          createdAt: terms.issuedAt,
          expiresAt: terms.expiresAt,
          idempotencyKeyHash: keyHash,
          requestHash,
          policySnapshot: {
            finance: policySnapshot(finance),
            quotation: terms.snapshot,
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
      if (enquiry.customer)
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
      else
        await enqueueSupportCustomerUpdate(tx, {
          kind: "enquiry",
          record: { id: enquiry.id, email: guestEmail, customer: null },
          messageId: null,
          notice: {
            title: "Your parts quotation is ready",
            summary: "The team has prepared a parts quotation for your request.",
          },
          response: `Quotation revision ${quote.revision}: ${quote.productName}. Quantity: ${quote.quantity}. Total: NGN ${(quote.totalKobo / 100n).toString()}.${(quote.totalKobo % 100n).toString().padStart(2, "0")}. Valid until ${quote.expiresAt.toISOString()}.\n\n${quote.notes}\n\nReview your quotation using private purchase access: ${new URL("/purchase", env.FRONTEND_VERIFY_EMAIL_URL).toString()}\nAn account is optional. Accepting a quotation creates an unpaid order; payment and final suitability, availability and collection readiness remain separate.`,
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

  async guestList(sessionToken: string, rawQuery: unknown) {
    if (env.PUBLIC_LAUNCH_MODE === "catalogue") throw supportNotFound();
    const query = purchaseQuoteListSchema.parse(rawQuery);
    const accessService = new PurchaseGuestAccessService(this.database);
    return this.database.$transaction(async (tx) => {
      const access = await accessService.lockAccess(tx, sessionToken, { kind: "read" });
      const owned = {
        guestEmail: access.email,
        status: { not: "DRAFT" as const },
        enquiry: { customerId: null },
      };
      if (
        query.cursor &&
        !(await tx.partsQuote.findFirst({
          where: { id: query.cursor, ...owned },
          select: { id: true },
        }))
      )
        throw supportNotFound();
      const rows = await tx.partsQuote.findMany({
        where: owned,
        include: {
          enquiry: {
            select: {
              branchId: true,
              branch: { select: { id: true, code: true, name: true, isActive: true } },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > query.limit,
        selected = rows.slice(0, query.limit);
      return {
        items: selected.map(({ enquiry, ...quote }) => {
          const snapshot = quote.policySnapshot;
          const branchId =
            snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
              ? snapshot["branchId"]
              : undefined;
          const branch = enquiry.branch;
          return {
            quotation: partsQuoteView(quote),
            collectionBranch:
              branch?.isActive && branch.id === branchId
                ? { id: branch.id, code: branch.code, name: branch.name }
                : null,
          };
        }),
        ...(hasMore ? { nextCursor: selected.at(-1)!.id } : {}),
      };
    });
  }

  async guestDecline(
    credentials: { sessionToken: string; csrfToken: string },
    id: string,
    revision: number,
    context: RequestSecurityContext,
  ) {
    if (!productPurchasesEnabled(env))
      throw supportConflict("Quotation changes are currently unavailable");
    const accessService = new PurchaseGuestAccessService(this.database);
    return withTransactionRetry(this.database, async (tx) => {
      const access = await accessService.lockAccess(tx, credentials.sessionToken, {
        kind: "write",
        csrfToken: credentials.csrfToken,
      });
      const owned = await tx.partsQuote.findFirst({
        where: { id, guestEmail: access.email, enquiry: { customerId: null } },
        select: { enquiryId: true },
      });
      if (!owned) throw supportNotFound();
      // Same lock order as issuance and acceptance; reread ownership after waiting.
      await tx.$queryRaw`SELECT "id" FROM "Enquiry" WHERE "id" = ${owned.enquiryId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "PartsQuote" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const quote = await tx.partsQuote.findFirst({
        where: { id, guestEmail: access.email, enquiry: { customerId: null } },
      });
      if (!quote) throw supportNotFound();
      if (quote.revision !== revision) throw supportStale();
      if (quote.status === "REJECTED") return partsQuoteView(quote);
      if (quote.status !== "ISSUED" || quote.expiresAt <= new Date())
        throw supportConflict("This quotation is no longer available for a decision");
      const updated = await tx.partsQuote.update({
        where: { id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      await appendAuditEvent(tx, {
        actorUserId: null,
        action: "STATUS_CHANGE",
        entityType: "ENQUIRY",
        entityId: quote.enquiryId,
        newValues: {
          guestId: access.guestId,
          quotationId: id,
          status: "REJECTED",
          revision,
        },
        context,
      });
      return partsQuoteView(updated);
    });
  }
}
export const partsQuotesService = new PartsQuotesService();
