import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../config/database.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import {
  currentPolicy,
  policySnapshot,
  assertCapability,
} from "../policies/policies.service.js";
import { orderConflict, orderForbidden, orderNotFound } from "./orders.errors.js";
import { assertCustomer, assertOrderOperator } from "./orders.policy.js";
import { customerAftercareSelect } from "./order-aftercare.schemas.js";

export async function requestAftercare(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  orderId: string,
  kind: "CANCELLATION" | "RETURN",
  reason: string,
  context: RequestSecurityContext,
  requestedItems?: Array<{ orderItemId: string; quantity: number }>,
) {
  assertCustomer(actor);
  await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
  const order = await tx.order.findFirst({
    where: { id: orderId, customer: { userId: actor.userId } },
    include: { items: true },
  });
  if (!order) throw orderNotFound();
  const items =
    requestedItems ??
    order.items.map((item) => ({ orderItemId: item.id, quantity: item.quantity }));
  if (
    !items.length ||
    new Set(items.map((item) => item.orderItemId)).size !== items.length ||
    items.some((item) => {
      const original = order.items.find((line) => line.id === item.orderItemId);
      return (
        !original ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > original.quantity
      );
    })
  )
    throw orderConflict("Choose valid order lines and quantities for review");
  const existing = await tx.orderAftercareRequest.findFirst({
    where: { orderId, kind, status: { not: "REJECTED" } },
    orderBy: { requestedAt: "desc" },
  });
  if (existing) return existing;
  const policy = await currentPolicy(tx, "cancellation");
  const elapsed = order.fulfillmentEvidenceAt
    ? Date.now() - order.fulfillmentEvidenceAt.getTime()
    : null;
  const reviewReason =
    kind === "CANCELLATION"
      ? order.processingAt
        ? "WORK_PURCHASING_OR_DELIVERY_REQUIRES_STAFF_REVIEW"
        : "CONFIRMATION_AND_MONETARY_BASIS_REQUIRE_REVIEW"
      : order.fulfillmentMethod === "COLLECTION"
        ? "COLLECTION_RETURN_CLOCK_REQUIRES_APPROVAL"
        : elapsed === null
          ? "DELIVERY_EVIDENCE_REQUIRED"
          : elapsed >= 14 * 86_400_000
            ? "BOUNDARY_OR_EXCEPTION_REVIEW_MANDATORY_RIGHTS_PRESERVED"
            : "WITHIN_PROPOSED_WINDOW_CONDITION_INSPECTION_REQUIRED";
  const record = await tx.orderAftercareRequest.create({
    data: {
      orderId,
      customerId: order.customerId,
      kind,
      reason,
      reviewReason,
      items,
      policySnapshot: policySnapshot(policy),
    },
  });
  await appendAuditEvent(tx, {
    actorUserId: actor.userId,
    action: "CREATE",
    entityType: "ORDER",
    entityId: orderId,
    newValues: { aftercareRequestId: record.id, kind, reviewReason },
    context,
  });
  return record;
}

export class OrderAftercareService {
  constructor(private readonly database = prisma) {}
  async request(
    actor: AuthenticatedActor,
    orderId: string,
    reason: string,
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction((tx) =>
      requestAftercare(tx, actor, orderId, "RETURN", reason, context),
    );
  }
  async requestPartial(
    actor: AuthenticatedActor,
    orderId: string,
    input: {
      kind: "RETURN" | "CANCELLATION";
      reason: string;
      items: Array<{ orderItemId: string; quantity: number }>;
    },
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction((tx) =>
      requestAftercare(
        tx,
        actor,
        orderId,
        input.kind,
        input.reason,
        context,
        input.items,
      ),
    );
  }
  async staffList(actor: AuthenticatedActor, orderId: string) {
    return this.database.$transaction(async (tx) => {
      await this.authorize(tx, actor, orderId);
      return tx.orderAftercareRequest.findMany({
        where: { orderId },
        orderBy: { requestedAt: "desc" },
        take: 100,
      });
    });
  }
  async list(actor: AuthenticatedActor, orderId: string) {
    assertCustomer(actor);
    if (
      !(await this.database.order.findFirst({
        where: { id: orderId, customer: { userId: actor.userId } },
      }))
    )
      throw orderNotFound();
    return this.database.orderAftercareRequest.findMany({
      where: { orderId },
      select: customerAftercareSelect,
      orderBy: { requestedAt: "desc" },
      take: 100,
    });
  }
  private async authorize(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    orderId: string,
  ) {
    assertOrderOperator(actor);
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw orderNotFound();
    if (actor.role === "STAFF") {
      const profile = await tx.staffProfile.findUnique({
        where: { userId: actor.userId },
      });
      if (!profile?.branchId || profile.branchId !== order.branchId)
        throw orderForbidden();
    }
    return order;
  }
  async fulfillmentEvidence(
    actor: AuthenticatedActor,
    orderId: string,
    at: string,
    reference: string,
    context: RequestSecurityContext,
  ) {
    const timestamp = new Date(at);
    if (!Number.isFinite(timestamp.getTime()) || timestamp > new Date())
      throw orderConflict("Fulfillment evidence date must not be in the future");
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
      const order = await this.authorize(tx, actor, orderId);
      if (timestamp < order.createdAt)
        throw orderConflict("Fulfillment must follow the order");
      if (order.fulfillmentEvidenceAt)
        throw orderConflict(
          "Fulfillment evidence is already recorded; use reviewed correction rather than rewriting history",
        );
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          fulfillmentEvidenceAt: timestamp,
          fulfillmentEvidenceReference: reference,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: orderId,
        newValues: { fulfillmentEvidenceAt: timestamp.toISOString(), reference },
        context,
      });
      return {
        id: updated.id,
        fulfillmentEvidenceAt: updated.fulfillmentEvidenceAt,
        fulfillmentEvidenceReference: updated.fulfillmentEvidenceReference,
      };
    });
  }
  async process(
    actor: AuthenticatedActor,
    id: string,
    input: {
      stage: "RECEIVED" | "INSPECTED" | "APPROVED" | "REJECTED";
      note: string;
      goodCondition?: boolean | undefined;
      approvedFeeKobo?: string | undefined;
      expectedStatus?: string | undefined;
    },
    context: RequestSecurityContext,
  ) {
    return this.database.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "OrderAftercareRequest" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const record = await tx.orderAftercareRequest.findUnique({ where: { id } });
      if (!record) throw orderNotFound();
      const order = await this.authorize(tx, actor, record.orderId);
      if (input.expectedStatus !== undefined && record.status !== input.expectedStatus)
        throw orderConflict("Request changed; refresh before reviewing another stage");
      if (["APPROVED", "REJECTED"].includes(record.status))
        throw orderConflict("This request already has a reviewed decision");
      const now = new Date();
      let data: Prisma.OrderAftercareRequestUncheckedUpdateInput;
      if (input.stage === "RECEIVED") {
        if (record.kind !== "RETURN" || record.status !== "REQUESTED")
          throw orderConflict("Only a requested return can be received");
        data = { status: "RECEIVED", receivedAt: now };
      } else if (input.stage === "INSPECTED") {
        if (
          record.kind !== "RETURN" ||
          record.status !== "RECEIVED" ||
          input.goodCondition === undefined
        )
          throw orderConflict("Receive goods and record condition before inspection");
        data = {
          status: "INSPECTED",
          inspectedAt: now,
          inspectedByUserId: actor.userId,
          inspectionNote: input.note,
          goodCondition: input.goodCondition,
        };
      } else {
        await assertCapability(tx, actor, "FINANCE_POLICY_APPROVE");
        if (input.stage === "APPROVED" && record.kind === "RETURN" && !record.inspectedAt)
          throw orderConflict("Inspect a received return before approval");
        if (
          input.stage === "APPROVED" &&
          order.confirmedAt !== null &&
          input.approvedFeeKobo === undefined
        )
          throw orderConflict(
            "Record the reviewed fee explicitly, including zero, and explain its monetary basis",
          );
        const fee = BigInt(input.approvedFeeKobo ?? "0");
        if (fee < 0n || fee > order.totalKobo)
          throw orderConflict("Reviewed fee must be within the order total");
        if (record.kind === "CANCELLATION" && order.confirmedAt === null && fee !== 0n)
          throw orderConflict("Cancellation before confirmation is free");
        data = {
          status: input.stage,
          reviewedAt: now,
          reviewedByUserId: actor.userId,
          reviewNote: input.note,
          approvedFeeKobo: fee,
        };
      }
      const updated = await tx.orderAftercareRequest.update({ where: { id }, data });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "UPDATE",
        entityType: "ORDER",
        entityId: record.orderId,
        newValues: {
          aftercareRequestId: id,
          stage: input.stage,
          note: input.note,
          approvedFeeKobo: input.approvedFeeKobo ?? null,
        },
        context,
      });
      // Inspection/approval never creates stock or marks a refund paid. Existing inventory
      // adjustment and segregated refund workflows require their own auditable actions.
      return updated;
    });
  }
}
