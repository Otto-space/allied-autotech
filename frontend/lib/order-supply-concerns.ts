import { z } from "zod";
const money = z.string().regex(/^\d+$/).max(19);
const date = z.iso.datetime({ offset: true });
export const supplyChoice = z.enum([
  "REFUND_REVIEW",
  "SUITABLE_ALTERNATIVE_REVIEW",
  "TECHNICAL_REVIEW",
]);
export const supplyKind = z.enum([
  "UNAVAILABLE",
  "WRONG_OR_UNSUITABLE_SUPPLY",
  "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE",
]);
export const supplyChoiceLabels = {
  REFUND_REVIEW: "Request refund review",
  SUITABLE_ALTERNATIVE_REVIEW: "Ask for a suitable alternative",
  TECHNICAL_REVIEW: "Request technical assessment",
} as const;
export const supplyKindLabels = {
  UNAVAILABLE: "Cannot supply the affected goods",
  WRONG_OR_UNSUITABLE_SUPPLY: "Wrong or unsuitable goods supplied",
  USED_INSTALLED_OR_DIAGNOSIS_DISPUTE: "Used, installed, defective or disputed goods",
} as const;
export const supplyRefundLabels = {
  REQUESTED: "Requested - awaiting independent approval",
  APPROVED: "Approved - awaiting processing",
  PENDING: "Pending - return of funds is not confirmed",
  PROCESSING: "Processing - return of funds is not confirmed",
  NEEDS_ATTENTION: "Financial review required - return of funds is not confirmed",
  SUCCEEDED: "Refund recorded as successful",
  FAILED: "Refund failed - Customer Care must review the next step",
  CANCELLED: "Refund request cancelled",
} as const;
const ranges = z
  .array(
    z.object({
      orderItemId: z.uuid(),
      offset: z.number().int().nonnegative(),
      quantity: z.number().int().positive(),
    }),
  )
  .min(1)
  .max(200);
const refund = z.object({
  id: z.uuid(),
  amountKobo: money,
  currency: z.literal("NGN"),
  status: z.enum([
    "REQUESTED",
    "APPROVED",
    "PENDING",
    "PROCESSING",
    "NEEDS_ATTENTION",
    "SUCCEEDED",
    "FAILED",
    "CANCELLED",
  ]),
  requestedAt: date,
  processedAt: date.nullable(),
});
const choice = z.object({
  id: z.uuid(),
  choice: supplyChoice,
  statementVersion: z.literal("SUPPLY_CHOICE_20261110_V1"),
  customerNote: z.string().max(1000),
  createdAt: date,
  orderVersion: z.number().int().nonnegative(),
  alternatives: z
    .array(
      z.object({
        id: z.uuid(),
        status: z.enum(["DRAFT", "ISSUED", "ACCEPTED", "REJECTED", "EXPIRED", "VOID"]),
        productName: z.string(),
        quantity: z.number().int().positive(),
        totalKobo: money,
        currency: z.literal("NGN"),
        expiresAt: date,
        orderId: z.uuid().nullable(),
        orderStatus: z.string().nullable(),
      }),
    )
    .max(10)
    .default([]),
  hasMoreAlternatives: z.boolean().default(false),
  refunds: z.array(refund).max(25),
  hasMoreRefunds: z.boolean(),
});
export const supplySummarySchema = z.object({
  orderId: z.uuid(),
  orderVersion: z.number().int().nonnegative(),
  resolutionCapabilityVersion: z.literal(1).optional(),
  closureCapabilityVersion: z.literal(1).optional(),
  closureReviewAvailable: z.boolean().default(false),
  cancelledReconciliationCapabilityVersion: z.literal(1).optional(),
  cancelledReconciliationReviewAvailable: z.boolean().default(false),
  cancelledReconciliationPreview: z
    .object({
      outcome: z.enum(["NO_CAPTURE_RECORDED", "CAPTURED_FUNDS_RETURNED"]),
      originalKobo: money,
      capturedKobo: money,
      refundedKobo: money,
      cancelledUnits: z.number().int().positive(),
    })
    .nullable()
    .default(null),
  reconciliations: z
    .array(
      z.object({
        id: z.uuid(),
        orderVersion: z.number().int().nonnegative(),
        createdAt: date,
        outcome: z.enum(["NO_CAPTURE_RECORDED", "CAPTURED_FUNDS_RETURNED"]),
        originalKobo: money,
        capturedKobo: money,
        refundedKobo: money,
        cancelledUnits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        reason: z.string().max(1000).optional(),
      }),
    )
    .max(10)
    .default([]),
  hasMoreReconciliations: z.boolean().default(false),
  closures: z
    .array(
      z.object({
        id: z.uuid(),
        orderVersion: z.number().int().nonnegative(),
        createdAt: date,
        resultingStatus: z.enum(["CANCELLED", "COMPLETED"]),
        originalKobo: money,
        refundedKobo: money,
        remainingKobo: money,
        originalUnits: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        refundedUnfulfilledUnits: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER),
        handedUnits: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        reason: z.string().max(1000).optional(),
      }),
    )
    .max(10)
    .default([]),
  hasMoreClosures: z.boolean().default(false),
  choiceStatementVersion: z.literal("SUPPLY_CHOICE_20261110_V1"),
  items: z
    .array(
      z.object({
        id: z.uuid(),
        orderId: z.uuid(),
        enquiryId: z.uuid(),
        kind: supplyKind,
        affectedLines: ranges,
        resolution: z
          .object({
            id: z.uuid(),
            orderVersion: z.number().int().nonnegative(),
            createdAt: date,
            reason: z.string().max(1000).optional(),
            unfulfilledLines: z.array(ranges.element).max(20000),
            previouslyHandedLines: z.array(ranges.element).max(20000),
          })
          .nullable()
          .optional(),
        customerNote: z.string().max(1000),
        reason: z.string().max(1000).optional(),
        createdAt: date,
        state: z.literal("CUSTOMER_CARE_REVIEW_REQUIRED"),
        alternativeAccepted: z.boolean(),
        financialApproval: z.literal(false),
        monetaryBasis: z.object({
          status: z.enum([
            "SAVED_ORDER_ALLOCATION",
            "HISTORICAL_BREAKDOWN_REVIEW_REQUIRED",
            "ATTRIBUTABLE_CHARGES_REVIEW_REQUIRED",
            "FINANCIAL_RECONCILIATION_REQUIRED",
            "TECHNICAL_ASSESSMENT_REQUIRED",
          ]),
          amounts: z
            .object({
              currency: z.literal("NGN"),
              subtotalKobo: money,
              discountKobo: money,
              taxKobo: money,
              totalKobo: money,
            })
            .nullable(),
          feeKobo: z.string().nullable(),
          reviewOnly: z.literal(true),
          financialApproval: z.literal(false),
        }),
        supplyRemedyChoices: z.array(choice).max(10),
        hasMoreChoices: z.boolean(),
      }),
    )
    .max(25),
  hasMore: z.boolean(),
});
export type SupplySummary = z.infer<typeof supplySummarySchema>;
export type SupplyOrder = {
  id: string;
  version: number;
  status: string;
  supplyConcernCapabilityVersion?: 1;
  items: { id: string; productName: string; quantity: number }[];
};
export function parseSupplySummary(value: unknown, order: SupplyOrder) {
  const data = supplySummarySchema.parse(value);
  if (
    data.orderId !== order.id ||
    new Set(data.items.map((row) => row.id)).size !== data.items.length
  )
    throw Error("Unexpected order supply history");
  if (new Set(data.closures.map((row) => row.id)).size !== data.closures.length)
    throw Error("Unexpected duplicate supply closure");
  const originalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
  if (
    new Set(data.reconciliations.map((row) => row.id)).size !==
    data.reconciliations.length
  )
    throw Error("Unexpected duplicate cancelled-order reconciliation");
  if (
    data.reconciliations.some((row) => row.orderVersion >= data.orderVersion) ||
    new Set([...data.closures, ...data.reconciliations].map((row) => row.id)).size !==
      data.closures.length + data.reconciliations.length
  )
    throw Error("Unexpected cancelled-order review identity or version");
  for (const row of [
    ...data.reconciliations,
    ...(data.cancelledReconciliationPreview ? [data.cancelledReconciliationPreview] : []),
  ]) {
    if (
      row.cancelledUnits !== originalUnits ||
      row.capturedKobo !== row.refundedKobo ||
      BigInt(row.originalKobo) <= BigInt(0) ||
      (row.outcome === "NO_CAPTURE_RECORDED") !== (row.capturedKobo === "0")
    )
      throw Error("Unexpected cancelled-order amounts or actual quantities");
  }
  for (const closure of data.closures) {
    if (
      closure.orderVersion >= data.orderVersion ||
      closure.originalUnits !== originalUnits ||
      closure.handedUnits + closure.refundedUnfulfilledUnits !== originalUnits ||
      BigInt(closure.refundedKobo) <= BigInt(0) ||
      BigInt(closure.originalKobo) !==
        BigInt(closure.refundedKobo) + BigInt(closure.remainingKobo) ||
      (closure.resultingStatus === "CANCELLED") !== (closure.handedUnits === 0) ||
      (closure.handedUnits === 0 && closure.remainingKobo !== "0")
    )
      throw Error("Unexpected supply closure amounts or actual quantities");
  }
  for (const row of data.items) {
    if (row.orderId !== order.id) throw Error("Unexpected supply concern");
    for (const line of row.affectedLines) {
      const item = order.items.find((item) => item.id === line.orderItemId);
      if (!item || line.offset + line.quantity > item.quantity)
        throw Error("Unexpected affected goods");
    }
    if (row.resolution) {
      const resolved = [
        ...row.resolution.unfulfilledLines,
        ...row.resolution.previouslyHandedLines,
      ].sort((a, b) => a.orderItemId.localeCompare(b.orderItemId) || a.offset - b.offset);
      if (
        row.resolution.orderVersion >= data.orderVersion ||
        resolved.some((part, index) => {
          const previous = resolved[index - 1];
          const covered = row.affectedLines
            .filter((actual) => actual.orderItemId === part.orderItemId)
            .reduce(
              (sum, actual) =>
                sum +
                Math.max(
                  0,
                  Math.min(part.offset + part.quantity, actual.offset + actual.quantity) -
                    Math.max(part.offset, actual.offset),
                ),
              0,
            );
          return (
            covered !== part.quantity ||
            (previous?.orderItemId === part.orderItemId &&
              previous.offset + previous.quantity > part.offset)
          );
        }) ||
        resolved.reduce((sum, part) => sum + part.quantity, 0) !==
          row.affectedLines.reduce((sum, part) => sum + part.quantity, 0)
      )
        throw Error("Unexpected supply resolution quantities");
    }
    if (
      new Set(row.supplyRemedyChoices.map((choice) => choice.orderVersion)).size !==
      row.supplyRemedyChoices.length
    )
      throw Error("Ambiguous choice history");
  }
  return data;
}
export function selectedSupplyRanges(form: FormData, items: SupplyOrder["items"]) {
  const selected = form.getAll("affected").map(String);
  if (
    !selected.length ||
    new Set(selected).size !== selected.length ||
    selected.some((id) => !items.some((item) => item.id === id))
  )
    throw Error("Select actual affected goods");
  return ranges.parse(
    selected.map((id) => {
      const item = items.find((item) => item.id === id)!;
      const first = Number(form.get(`${id}-first`)),
        quantity = Number(form.get(`${id}-quantity`));
      if (
        !Number.isInteger(first) ||
        first < 1 ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        first - 1 + quantity > item.quantity
      )
        throw Error("Choose actual bounded quantities");
      return { orderItemId: id, offset: first - 1, quantity };
    }),
  );
}
export const supplyRangeSignature = (lines: z.infer<typeof ranges>) =>
  JSON.stringify(
    lines
      .map((line) => [line.orderItemId, line.offset, line.quantity])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
export function supplyChoiceLocked(row: SupplySummary["items"][number]) {
  return (
    row.hasMoreChoices ||
    row.supplyRemedyChoices.some(
      (choice) =>
        choice.hasMoreAlternatives ||
        choice.alternatives.some(
          (quote) =>
            quote.status === "ACCEPTED" &&
            quote.orderId &&
            quote.orderStatus !== "CANCELLED",
        ),
    ) ||
    row.supplyRemedyChoices.some(
      (choice) =>
        choice.hasMoreRefunds ||
        choice.refunds.some((refund) => !["FAILED", "CANCELLED"].includes(refund.status)),
    )
  );
}

export function remainingSupplyRefundAmount(row: SupplySummary["items"][number]) {
  if (
    row.hasMoreChoices ||
    row.supplyRemedyChoices.some((choice) => choice.hasMoreRefunds) ||
    row.monetaryBasis.status !== "SAVED_ORDER_ALLOCATION" ||
    !row.monetaryBasis.amounts
  )
    return null;
  const total = BigInt(row.monetaryBasis.amounts.totalKobo);
  const committed = row.supplyRemedyChoices
    .flatMap((choice) => choice.refunds)
    .filter((refund) => !["FAILED", "CANCELLED"].includes(refund.status))
    .reduce((sum, refund) => sum + BigInt(refund.amountKobo), BigInt(0));
  if (committed > total) return null;
  return (total - committed).toString();
}

/** Enables a review only; the server rechecks the actual ledger and physical facts. */
export function canReviewSupplyResolution(row: SupplySummary["items"][number]) {
  const current = row.supplyRemedyChoices[0];
  if (
    row.resolution ||
    row.hasMoreChoices ||
    row.kind === "USED_INSTALLED_OR_DIAGNOSIS_DISPUTE" ||
    row.monetaryBasis.status !== "SAVED_ORDER_ALLOCATION" ||
    !row.monetaryBasis.amounts ||
    !current ||
    current.hasMoreRefunds ||
    current.hasMoreAlternatives ||
    !(
      current.choice === "REFUND_REVIEW" ||
      (current.choice === "SUITABLE_ALTERNATIVE_REVIEW" && row.alternativeAccepted)
    )
  )
    return false;
  const active = current.refunds.filter(
    (refund) => !["FAILED", "CANCELLED"].includes(refund.status),
  );
  return (
    active.length > 0 &&
    active.every(
      (refund) => refund.status === "SUCCEEDED" && refund.processedAt !== null,
    ) &&
    active.reduce((sum, refund) => sum + BigInt(refund.amountKobo), BigInt(0)) ===
      BigInt(row.monetaryBasis.amounts.totalKobo)
  );
}
