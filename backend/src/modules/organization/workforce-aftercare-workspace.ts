import { hashToken } from "../../common/security/session-tokens.js";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { aftercareItemSchema } from "../orders/order-aftercare.schemas.js";
import {
  branchesFor,
  workforceDenied,
  type WorkforceSnapshot,
} from "./workforce.policy.js";

/** The independent financial duty intersects existing scoped finance reading.
 * It never supplies general order/customer access or operational receiving duties.
 */
export function aftercareBranches(access: WorkforceSnapshot) {
  if (
    !access.managed ||
    !access.independentCapabilities.includes("FINANCE_POLICY_APPROVE")
  )
    workforceDenied();
  const branches = branchesFor(access, "FINANCE_READ");
  if (!branches.length) workforceDenied();
  return branches;
}
export const aftercareSummarySelect = {
  id: true,
  orderId: true,
  kind: true,
  status: true,
  requestedAt: true,
  receivedAt: true,
  inspectedAt: true,
  reviewedAt: true,
  approvedFeeKobo: true,
  orderIdRelation: {
    select: {
      id: true,
      orderNumber: true,
      branchId: true,
      branch: { select: { id: true, name: true } },
      currency: true,
      totalKobo: true,
      confirmedAt: true,
      fulfillmentMethod: true,
    },
  },
} satisfies Prisma.OrderAftercareRequestSelect;
export const aftercareDetailSelect = {
  ...aftercareSummarySelect,
  reason: true,
  reviewReason: true,
  items: true,
  inspectionNote: true,
  goodCondition: true,
  reviewNote: true,
  policySnapshot: true,
  orderIdRelation: {
    select: {
      ...aftercareSummarySelect.orderIdRelation.select,
      items: {
        select: { id: true, productName: true, quantity: true },
        orderBy: { id: "asc" as const },
      },
    },
  },
} satisfies Prisma.OrderAftercareRequestSelect;
type Summary = Prisma.OrderAftercareRequestGetPayload<{
  select: typeof aftercareSummarySelect;
}>;
type Detail = Prisma.OrderAftercareRequestGetPayload<{
  select: typeof aftercareDetailSelect;
}>;
const policySchema = z.object({
  id: z.uuid(),
  key: z.string().min(1).max(100),
  version: z.number().int().positive(),
  approvalStatus: z.string().min(1).max(80),
  source: z.string().min(1).max(10000),
  effectiveAt: z.iso.datetime({ offset: true }),
});
export function projectAftercareSummary(row: Summary) {
  const order = row.orderIdRelation;
  return {
    id: row.id,
    orderId: row.orderId,
    kind: row.kind,
    status: row.status,
    requestedAt: row.requestedAt,
    receivedAt: row.receivedAt,
    inspectedAt: row.inspectedAt,
    reviewedAt: row.reviewedAt,
    approvedFeeKobo: row.approvedFeeKobo?.toString() ?? null,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      branch: order.branch,
      currency: order.currency,
      totalKobo: order.totalKobo.toString(),
      confirmedAt: order.confirmedAt,
      fulfillmentMethod: order.fulfillmentMethod,
    },
  };
}
export function projectAftercareDetail(row: Detail) {
  const parsedItems = z.array(aftercareItemSchema).min(1).max(100).safeParse(row.items);
  const validItems =
    parsedItems.success &&
    new Set(parsedItems.data.map((i) => i.orderItemId)).size ===
      parsedItems.data.length &&
    parsedItems.data.every((i) =>
      row.orderIdRelation.items.some(
        (original) => original.id === i.orderItemId && i.quantity <= original.quantity,
      ),
    );
  const requestedItems = validItems
    ? parsedItems.data.map((i) => {
        const original = row.orderIdRelation.items.find(
          (line) => line.id === i.orderItemId,
        )!;
        return {
          ...i,
          orderedQuantity: original.quantity,
          productName: original.productName,
        };
      })
    : null;
  const parsedPolicy = policySchema.safeParse(row.policySnapshot);
  const policy = parsedPolicy.success ? parsedPolicy.data : null;
  // Select explicit fields: neither customer data nor raw policy settings may leak
  // when a legacy relation/model gains new properties.
  const summary = projectAftercareSummary(row);
  const facts = {
    id: summary.id,
    orderId: summary.orderId,
    kind: summary.kind,
    status: summary.status,
    requestedAt: summary.requestedAt,
    receivedAt: summary.receivedAt,
    inspectedAt: summary.inspectedAt,
    reviewedAt: summary.reviewedAt,
    approvedFeeKobo: summary.approvedFeeKobo,
    order: {
      id: summary.order.id,
      orderNumber: summary.order.orderNumber,
      branchId: summary.order.branchId,
      branch: summary.order.branch,
      currency: summary.order.currency,
      totalKobo: summary.order.totalKobo,
      confirmedAt: summary.order.confirmedAt,
      fulfillmentMethod: summary.order.fulfillmentMethod,
    },
    reason: row.reason,
    reviewReason: row.reviewReason,
    inspectionNote: row.inspectionNote,
    goodCondition: row.goodCondition,
    reviewNote: row.reviewNote,
    requestedItems,
    policy,
    reviewEvidenceReady:
      !!requestedItems &&
      !!policy &&
      ["RETURN", "CANCELLATION"].includes(row.kind) &&
      ["REQUESTED", "RECEIVED", "INSPECTED"].includes(row.status),
  };
  // Bind all stored evidence, including currently unprojected policy settings, so
  // an authorised legacy correction invalidates an open review without a migration.
  const reviewRevision = hashToken(
    "workforce-aftercare-review",
    JSON.stringify({ facts, storedItems: row.items, storedPolicy: row.policySnapshot }),
  );
  return { ...facts, reviewRevision };
}
const timestamp = z.iso.datetime({ offset: true });
const money = z.string().regex(/^\d+$/);
export const workforceAftercareRowSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  kind: z.string(),
  status: z.string(),
  requestedAt: timestamp,
  receivedAt: timestamp.nullable(),
  inspectedAt: timestamp.nullable(),
  reviewedAt: timestamp.nullable(),
  approvedFeeKobo: money.nullable(),
  order: z.object({
    id: z.uuid(),
    orderNumber: z.string(),
    branchId: z.uuid(),
    branch: z.object({ id: z.uuid(), name: z.string() }),
    currency: z.literal("NGN"),
    totalKobo: money,
    confirmedAt: timestamp.nullable(),
    fulfillmentMethod: z.enum(["COLLECTION", "DELIVERY"]),
  }),
});
export const workforceAftercareDetailSchema = workforceAftercareRowSchema.extend({
  reason: z.string(),
  reviewReason: z.string(),
  inspectionNote: z.string().nullable(),
  goodCondition: z.boolean().nullable(),
  reviewNote: z.string().nullable(),
  requestedItems: z
    .array(
      aftercareItemSchema.extend({
        orderedQuantity: z.number().int().positive(),
        productName: z.string(),
      }),
    )
    .nullable(),
  policy: policySchema.nullable(),
  reviewEvidenceReady: z.boolean(),
  reviewRevision: z.string().regex(/^[a-f0-9]{64}$/),
});
