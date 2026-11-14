import { isDeepStrictEqual } from "node:util";
import {
  cancelledSupplySnapshot,
  cancelledReconciliationFilter,
} from "./order-cancelled-supply-reconciliation.js";
import { savedSupplyExclusions } from "./order-supply-exception-hold.js";
import { AppError } from "../../common/errors/app-error.js";
import { recordSupplyClosure } from "./order-supply-closure.js";
import { recordSupplyResolution } from "./order-supply-resolution.js";
import {
  collectedPickupUnitRanges,
  pickupUnitRangeDifference,
  remainingPickupUnitRanges,
} from "./order-pickup-units.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { lockCurrentPaymentCustomer } from "../payments/payments.policy.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { notifySupportTeam } from "../notifications/team-notifications.js";
import { enqueueDepartmentEmail } from "../support/department-email.js";
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
  affectedUnitRangesSchema,
  assertNoSupplyOverlap,
  assertSupplyExceptionRanges,
  supplyExceptionMoneyBasis,
} from "./order-supply-exception.engine.js";
import { pickupUnitHistory } from "./order-pickup.repository.js";
import {
  supplyExceptionRaiseSchema,
  supplyRemedyChoiceSchema,
  supplyResolutionSchema,
  supplyClosureSchema,
} from "./order-supply-exception.schemas.js";
const select = {
  id: true,
  orderNumber: true,
  version: true,
  status: true,
  readyAt: true,
  fulfillmentMethod: true,
  paidAt: true,
  customerId: true,
  guestId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  branchId: true,
  branch: { select: { isActive: true } },
  customer: { select: { userId: true } },
  subtotalKobo: true,
  discountAmountKobo: true,
  taxKobo: true,
  totalKobo: true,
  currency: true,
  deliveryFeeKobo: true,
  policySnapshot: true,
  items: {
    select: {
      id: true,
      productName: true,
      productId: true,
      quantity: true,
      unitPriceKobo: true,
      subtotalKobo: true,
    },
  },
} satisfies Prisma.OrderSelect;
type SupplyOrder = Prisma.OrderGetPayload<{ select: typeof select }>;
export async function lockSupplyOrder(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id}::uuid FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id }, select });
  if (!order) throw orderNotFound();
  return order;
}
async function openRanges(tx: Prisma.TransactionClient, id: string) {
  const records = await tx.orderSupplyException.findMany({
    where: { orderId: id },
    select: { affectedLines: true },
  });
  return records.flatMap((record) =>
    affectedUnitRangesSchema.parse(record.affectedLines),
  );
}
export async function supplyExceptionSummary(
  tx: Prisma.TransactionClient,
  id: string,
  administrator = false,
) {
  const records = await tx.orderSupplyException.findMany({
    where: { orderId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 26,
    select: {
      id: true,
      orderId: true,
      enquiryId: true,
      kind: true,
      affectedLines: true,
      monetaryBasis: true,
      customerNote: true,
      reason: administrator,
      createdAt: true,
      resolution: {
        select: {
          id: true,
          orderVersion: true,
          reason: administrator,
          createdAt: true,
          unfulfilledLines: true,
          previouslyHandedLines: true,
        },
      },
      supplyRemedyChoices: {
        orderBy: { orderVersion: "desc" },
        take: 11,
        select: {
          id: true,
          choice: true,
          statementVersion: true,
          customerNote: true,
          createdAt: true,
          orderVersion: true,
          partsQuotes: {
            orderBy: [{ revision: "desc" }, { id: "desc" }],
            take: 11,
            select: {
              id: true,
              status: true,
              productName: true,
              quantity: true,
              totalKobo: true,
              currency: true,
              expiresAt: true,
              orderId: true,
              order: { select: { status: true } },
            },
          },
          refunds: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 26,
            select: {
              id: true,
              amountKobo: true,
              currency: true,
              status: true,
              requestedAt: true,
              processedAt: true,
            },
          },
        },
      },
    },
  });
  const order = await tx.order.findUniqueOrThrow({
    where: { id },
    select: {
      version: true,
      status: true,
      items: { select: { id: true, quantity: true } },
    },
  });
  const reconciliations = await tx.orderSupplyClosure.findMany({
    where: {
      orderId: id,
      ...cancelledReconciliationFilter,
    },
    orderBy: [{ orderVersion: "desc" }, { id: "desc" }],
    take: 11,
    select: {
      id: true,
      orderVersion: true,
      createdAt: true,
      financialSnapshot: true,
      reason: administrator,
    },
  });
  let cancelledReconciliationReviewAvailable = false;
  let cancelledReconciliationPreview: {
    outcome: string;
    originalKobo: string;
    capturedKobo: string;
    refundedKobo: string;
    cancelledUnits: number;
  } | null = null;
  if (administrator && order.status === "CANCELLED" && records.length) {
    try {
      const actual = await cancelledSupplySnapshot(tx, id);
      cancelledReconciliationReviewAvailable = !reconciliations.some((row) =>
        isDeepStrictEqual(row.financialSnapshot, actual),
      );
      if (cancelledReconciliationReviewAvailable)
        cancelledReconciliationPreview = {
          outcome: actual.outcome,
          originalKobo: actual.originalKobo,
          capturedKobo: actual.capturedKobo,
          refundedKobo: actual.refundedKobo,
          cancelledUnits: actual.cancelledUnits,
        };
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 409)) throw error;
    }
  }
  const closures = await tx.orderSupplyClosure.findMany({
    where: {
      orderId: id,
      financialSnapshot: { path: ["version"], equals: "ORDER_SUPPLY_CLOSURE_V1" },
    },
    orderBy: [{ orderVersion: "desc" }, { id: "desc" }],
    take: 11,
    select: {
      id: true,
      orderVersion: true,
      createdAt: true,
      resultingStatus: true,
      financialSnapshot: true,
      reason: administrator,
    },
  });
  let closureReviewAvailable = false;
  if (administrator && records.length && records.every((row) => row.resolution)) {
    try {
      const resolutionCount = await tx.orderSupplyResolution.count({
        where: { orderId: id },
      });
      const concernCount = await tx.orderSupplyException.count({
        where: { orderId: id },
      });
      const handoverCount = await tx.orderPickupHandover.count({
        where: { orderId: id },
      });
      const previous = closures[0]?.financialSnapshot as
        { supplyResolutionIds?: unknown[]; handoverIds?: unknown[] } | undefined;
      closureReviewAvailable =
        resolutionCount === concernCount &&
        (!previous ||
          previous.supplyResolutionIds?.length !== resolutionCount ||
          previous.handoverIds?.length !== handoverCount) &&
        remainingPickupUnitRanges(
          order.items.map((row) => ({ orderItemId: row.id, quantity: row.quantity })),
          await pickupUnitHistory(tx, id),
          await savedSupplyExclusions(tx, id),
        ).length === 0;
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 409)) throw error;
    }
  }
  return {
    orderId: id,
    orderVersion: order.version,
    closureReviewAvailable,
    cancelledReconciliationCapabilityVersion: 1 as const,
    cancelledReconciliationReviewAvailable,
    cancelledReconciliationPreview,
    reconciliations: reconciliations.slice(0, 10).map(({ financialSnapshot, ...row }) => {
      const saved = financialSnapshot as {
        outcome: string;
        originalKobo: string;
        capturedKobo: string;
        refundedKobo: string;
        cancelledUnits: number;
      };
      return {
        ...row,
        outcome: saved.outcome,
        originalKobo: saved.originalKobo,
        capturedKobo: saved.capturedKobo,
        refundedKobo: saved.refundedKobo,
        cancelledUnits: saved.cancelledUnits,
      };
    }),
    hasMoreReconciliations: reconciliations.length > 10,
    resolutionCapabilityVersion: 1 as const,
    closureCapabilityVersion: 1 as const,
    closures: closures.slice(0, 10).map(({ financialSnapshot, ...row }) => {
      const proof = financialSnapshot as {
        originalKobo: string;
        refundedKobo: string;
        remainingKobo: string;
        originalUnits: number;
        refundedUnfulfilledUnits: number;
        handedUnits: number;
      };
      return {
        ...row,
        originalKobo: proof.originalKobo,
        refundedKobo: proof.refundedKobo,
        remainingKobo: proof.remainingKobo,
        originalUnits: proof.originalUnits,
        refundedUnfulfilledUnits: proof.refundedUnfulfilledUnits,
        handedUnits: proof.handedUnits,
      };
    }),
    hasMoreClosures: closures.length > 10,
    choiceStatementVersion: "SUPPLY_CHOICE_20261110_V1" as const,
    items: records.slice(0, 25).map((record) => ({
      ...record,
      affectedLines: affectedUnitRangesSchema.parse(record.affectedLines),
      state: "CUSTOMER_CARE_REVIEW_REQUIRED" as const,
      supplyRemedyChoices: record.supplyRemedyChoices.slice(0, 10).map((choice) => {
        const { partsQuotes, ...saved } = choice;
        return {
          ...saved,
          alternatives: partsQuotes.slice(0, 10).map(({ order, ...quote }) => ({
            ...quote,
            totalKobo: quote.totalKobo.toString(),
            orderStatus: order?.status ?? null,
          })),
          hasMoreAlternatives: partsQuotes.length > 10,
          refunds: choice.refunds
            .slice(0, 25)
            .map((refund) => ({ ...refund, amountKobo: refund.amountKobo.toString() })),
          hasMoreRefunds: choice.refunds.length > 25,
        };
      }),
      hasMoreChoices: record.supplyRemedyChoices.length > 10,
      // Intent never means a substitute was accepted, finance approved, or paid.
      alternativeAccepted: record.supplyRemedyChoices.some((choice) =>
        choice.partsQuotes.some(
          (quote) =>
            quote.status === "ACCEPTED" &&
            quote.orderId &&
            quote.order?.status !== "CANCELLED",
        ),
      ),
      financialApproval: false as const,
    })),
    hasMore: records.length > 25,
  };
}
/** Caller holds the actual order and current administrator locks. This records a
 * concern and an existing Care conversation, never technical/financial approval. */
export async function recordSupplyException(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  order: SupplyOrder,
  input: Omit<z.infer<typeof supplyExceptionRaiseSchema>, "actualConcernConfirmed">,
  context: RequestSecurityContext,
  sourceTimingUpdateId?: string,
) {
  const requestHash = orderFingerprint({
    orderId: order.id,
    ...input,
    ...(sourceTimingUpdateId ? { sourceTimingUpdateId } : {}),
  });
  const prior = await tx.orderSupplyException.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (prior) {
    if (prior.orderId !== order.id || prior.requestHash !== requestHash)
      throw orderConflict("This supply review reference was used for different details.");
    return prior;
  }
  if (order.version !== input.expectedVersion) throw orderStale();
  if (order.status === "CANCELLED" || !order.branchId || !order.branch?.isActive)
    throw orderConflict(
      "Review actual active branch goods before recording this concern.",
    );
  try {
    assertSupplyExceptionRanges(order.items, input.affectedLines);
    assertNoSupplyOverlap(input.affectedLines, await openRanges(tx, order.id));
  } catch {
    throw orderConflict(
      "Choose actual quantities that do not already have an unresolved supply case.",
    );
  }
  if (input.kind === "UNAVAILABLE") {
    if (order.status === "COMPLETED")
      throw orderConflict(
        "A completed order needs actual wrong-supply or technical assessment, not an unfulfilled-goods claim.",
      );
    const collected = collectedPickupUnitRanges(
      order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
      await pickupUnitHistory(tx, order.id),
    );
    try {
      assertNoSupplyOverlap(input.affectedLines, collected);
    } catch {
      throw orderConflict(
        "Already collected goods need an actual wrong-supply or technical assessment; do not label them unfulfilled.",
      );
    }
  }
  let basis: Prisma.InputJsonValue;
  try {
    basis = supplyExceptionMoneyBasis(
      order,
      input.affectedLines,
    ) as Prisma.InputJsonValue;
  } catch {
    basis = { status: "FINANCIAL_RECONCILIATION_REQUIRED", amounts: null, feeKobo: "0" };
  }
  if (input.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE")
    basis = { status: "TECHNICAL_ASSESSMENT_REQUIRED", amounts: null, feeKobo: null };
  const monetaryBasis = {
    ...(basis as Record<string, Prisma.InputJsonValue | null>),
    reviewOnly: true,
    provenance: "ENGINEERING_UNDER_OWNER_D17_DELEGATION",
    financialApproval: false,
  };
  const productNames = input.affectedLines.map(
    (line) => order.items.find((item) => item.id === line.orderItemId)!.productName,
  );
  const enquiry = await tx.enquiry.create({
    data: {
      customerId: order.customerId,
      branchId: order.branchId,
      type: "PRODUCT",
      subject: "Order supply concern: review required",
      message: `Order ${order.orderNumber ?? order.id}: ${input.customerNote}\nAffected goods: ${productNames.join(", ")}. Review actual quantities and agreed remedy before any collection or financial action.`,
      name: order.customerName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    select: { id: true },
  });
  const record = await tx.orderSupplyException.create({
    data: {
      orderId: order.id,
      enquiryId: enquiry.id,
      sourceTimingUpdateId: sourceTimingUpdateId ?? null,
      raisedByUserId: actor.userId,
      sessionId: actor.sessionId,
      orderVersion: order.version,
      kind: input.kind,
      affectedLines: input.affectedLines,
      monetaryBasis,
      customerNote: input.customerNote,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      requestHash,
    },
  });
  await notifySupportTeam(tx, {
    kind: "ENQUIRY",
    id: enquiry.id,
    event: `supply:${record.id}`,
    title: "Order supply concern needs review",
    actorUserId: actor.userId,
  });
  if (z.email().safeParse(order.customerEmail).success)
    await enqueueDepartmentEmail(tx, {
      id: enquiry.id,
      type: "ORDER_SUPPLY",
      email: order.customerEmail,
      subject: "Order supply concern: review required",
      message: input.customerNote,
    });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "CREATE",
    entityType: "ORDER",
    entityId: order.id,
    newValues: {
      supplyExceptionId: record.id,
      enquiryId: enquiry.id,
      kind: input.kind,
      affectedRangeCount: input.affectedLines.length,
      sourceTimingUpdateId: sourceTimingUpdateId ?? null,
    },
    context,
  });
  return record;
}
export async function ensureUnavailableSupplyCase(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  id: string,
  source: {
    id: string;
    lines: { orderItemId: string; sourcingStatus: string }[];
    customerNote: string;
    reason: string;
  },
  context: RequestSecurityContext,
) {
  if (!source.lines.some((line) => line.sourcingStatus === "UNAVAILABLE")) return null;
  const order = await lockSupplyOrder(tx, id),
    covered = await openRanges(tx, id),
    collected = collectedPickupUnitRanges(
      order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity })),
      await pickupUnitHistory(tx, id),
    );
  const ranges = source.lines
    .filter((line) => line.sourcingStatus === "UNAVAILABLE")
    .flatMap((line) => {
      const original = order.items.find((item) => item.id === line.orderItemId);
      if (!original) throw orderConflict("Review actual order items.");
      return pickupUnitRangeDifference(
        pickupUnitRangeDifference(
          [{ orderItemId: original.id, offset: 0, quantity: original.quantity }],
          collected,
        ),
        covered,
      );
    });
  if (!ranges.length) return null;
  return recordSupplyException(
    tx,
    actor,
    order,
    {
      expectedVersion: order.version,
      idempotencyKey: randomUUID(),
      kind: "UNAVAILABLE",
      affectedLines: ranges,
      customerNote:
        source.customerNote.length >= 12
          ? source.customerNote
          : "An ordered item is unavailable. Customer Care must review the next step with you.",
      reason:
        source.reason.length >= 12
          ? source.reason
          : "Administrator recorded unavailable sourcing; actual concern needs Customer Care review.",
    },
    context,
    source.id,
  );
}
type Buyer =
  | { kind: "account"; actor: AuthenticatedActor }
  | { kind: "guest"; sessionToken: string; csrfToken?: string };
export class OrderSupplyExceptionService {
  private readonly guests: PurchaseGuestAccessService;
  constructor(private readonly database: PrismaClient = prisma) {
    this.guests = new PurchaseGuestAccessService(database);
  }
  private async buyerOrder(
    tx: Prisma.TransactionClient,
    buyer: Buyer,
    id: string,
    write: boolean,
  ) {
    const guest =
      buyer.kind === "guest"
        ? env.PUBLIC_LAUNCH_MODE === "catalogue"
          ? null
          : await this.guests.lockAccess(
              tx,
              buyer.sessionToken,
              write
                ? { kind: "write", csrfToken: buyer.csrfToken ?? "" }
                : { kind: "read" },
            )
        : null;
    if (buyer.kind === "account") await lockCurrentPaymentCustomer(tx, buyer.actor);
    else if (!guest) throw orderForbidden();
    const order = await lockSupplyOrder(tx, id);
    if (
      buyer.kind === "account"
        ? order.customer?.userId !== buyer.actor.userId || order.guestId !== null
        : order.guestId !== guest!.guestId || order.customerId !== null
    )
      throw orderNotFound();
    return { order, guest };
  }
  read(buyer: Buyer, id: string) {
    return withTransactionRetry(
      this.database,
      async (tx) => {
        await this.buyerOrder(tx, buyer, id, false);
        return supplyExceptionSummary(tx, id);
      },
      { isolationLevel: "Serializable" },
    );
  }
  choose(buyer: Buyer, id: string, raw: unknown, context: RequestSecurityContext) {
    const input = supplyRemedyChoiceSchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        const { order, guest } = await this.buyerOrder(tx, buyer, id, true);
        const requestHash = orderFingerprint({ orderId: id, ...input });
        const prior = await tx.orderSupplyRemedyChoice.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { guestSession: { select: { guestId: true } } },
        });
        if (prior) {
          if (
            prior.orderId !== id ||
            prior.requestHash !== requestHash ||
            (buyer.kind === "account"
              ? prior.customerUserId !== buyer.actor.userId
              : prior.guestSession?.guestId !== guest!.guestId)
          )
            throw orderConflict(
              "This remedy request reference was used for different details.",
            );
          return supplyExceptionSummary(tx, id);
        }
        if (
          await tx.orderSupplyClosure.count({
            where: {
              orderId: id,
              ...cancelledReconciliationFilter,
            },
          })
        )
          throw orderConflict(
            "The original order is cancelled and its payment review is recorded. Contact Customer Care for a new concern rather than changing this historical request.",
          );
        if (input.expectedVersion !== order.version) throw orderStale();
        const concern = await tx.orderSupplyException.findFirst({
          where: { id: input.supplyExceptionId, orderId: id },
          select: { id: true, kind: true, enquiryId: true },
        });
        if (!concern) throw orderNotFound();
        if (
          (concern.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE") !==
          (input.choice === "TECHNICAL_REVIEW")
        )
          throw orderConflict(
            "Used, installed or disputed goods need technical assessment. This request cannot approve a general return.",
          );
        const acceptedAlternative = await tx.partsQuote.count({
          where: {
            supplyRemedyChoice: { supplyExceptionId: concern.id },
            status: "ACCEPTED",
            orderId: { not: null },
            order: { status: { not: "CANCELLED" } },
          },
        });
        if (acceptedAlternative)
          throw orderConflict(
            "An alternative order was already accepted. Reconcile or cancel that actual order before changing this request.",
          );
        if (
          await tx.refund.count({
            where: {
              supplyRemedyChoice: { supplyExceptionId: concern.id },
              status: { notIn: ["FAILED", "CANCELLED"] },
            },
          })
        )
          throw orderConflict(
            "A refund is already committed to this choice. Customer Care must reconcile its outcome before another choice.",
          );
        const choice = await tx.orderSupplyRemedyChoice.create({
          data: {
            orderId: id,
            supplyExceptionId: concern.id,
            orderVersion: order.version,
            customerUserId: buyer.kind === "account" ? buyer.actor.userId : null,
            sessionId: buyer.kind === "account" ? buyer.actor.sessionId : null,
            guestSessionId: guest?.sessionId ?? null,
            choice: input.choice,
            statementVersion: input.statementVersion,
            customerNote: input.customerNote ?? "",
            idempotencyKey: input.idempotencyKey,
            requestHash,
          },
        });
        await tx.order.update({ where: { id }, data: { version: { increment: 1 } } });
        await notifySupportTeam(tx, {
          kind: "ENQUIRY",
          id: concern.enquiryId,
          event: `supply-remedy-choice:${choice.id}`,
          title: "Customer updated an order supply remedy request",
          ...(buyer.kind === "account" ? { actorUserId: buyer.actor.userId } : {}),
        });
        await appendAuditEvent(tx, {
          actorUserId: buyer.kind === "account" ? buyer.actor.userId : null,
          action: "CREATE",
          entityType: "ORDER",
          entityId: id,
          newValues: {
            supplyExceptionId: concern.id,
            remedyChoiceId: choice.id,
            choice: input.choice,
            financialApproval: false,
            alternativeAccepted: false,
          },
          context,
        });
        return supplyExceptionSummary(tx, id);
      },
      { isolationLevel: "Serializable" },
    );
  }
  private async operator(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    id: string,
  ) {
    assertOrderOperator(actor);
    await lockAccessActor(tx, actor);
    const order = await lockSupplyOrder(tx, id);
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
  readStaff(actor: AuthenticatedActor, id: string, context: RequestSecurityContext) {
    return withTransactionRetry(
      this.database,
      async (tx) => {
        await this.operator(tx, actor, id);
        const summary = await supplyExceptionSummary(tx, id, actor.role !== "STAFF");
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "READ",
          entityType: "ORDER",
          entityId: id,
          newValues: { workspace: "order-supply-concerns", count: summary.items.length },
          context,
        });
        return summary;
      },
      { isolationLevel: "Serializable" },
    );
  }
  raise(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = supplyExceptionRaiseSchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN")
          throw orderForbidden();
        const order = await this.operator(tx, actor, id);
        const prior = await tx.orderSupplyException.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true },
        });
        const { actualConcernConfirmed: _, ...facts } = input;
        void _;
        await recordSupplyException(tx, actor, order, facts, context);
        if (!prior)
          await tx.order.update({ where: { id }, data: { version: { increment: 1 } } });
        return supplyExceptionSummary(tx, id, true);
      },
      { isolationLevel: "Serializable" },
    );
  }
  close(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = supplyClosureSchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN")
          throw orderForbidden();
        const order = await this.operator(tx, actor, id);
        const result = await recordSupplyClosure(tx, actor, order, input, context);
        return {
          ...(await supplyExceptionSummary(tx, id, true)),
          replayed: result.replayed,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
  resolve(
    actor: AuthenticatedActor,
    id: string,
    raw: unknown,
    context: RequestSecurityContext,
  ) {
    const input = supplyResolutionSchema.parse(raw);
    return withTransactionRetry(
      this.database,
      async (tx) => {
        if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN")
          throw orderForbidden();
        const order = await this.operator(tx, actor, id);
        const result = await recordSupplyResolution(tx, actor, order, input, context);
        return {
          ...(await supplyExceptionSummary(tx, id, true)),
          replayed: result.replayed,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }
}
