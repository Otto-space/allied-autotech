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
  refunds: z.array(refund).max(25),
  hasMoreRefunds: z.boolean(),
});
export const supplySummarySchema = z.object({
  orderId: z.uuid(),
  orderVersion: z.number().int().nonnegative(),
  choiceStatementVersion: z.literal("SUPPLY_CHOICE_20261110_V1"),
  items: z
    .array(
      z.object({
        id: z.uuid(),
        orderId: z.uuid(),
        enquiryId: z.uuid(),
        kind: supplyKind,
        affectedLines: ranges,
        customerNote: z.string().max(1000),
        reason: z.string().max(1000).optional(),
        createdAt: date,
        state: z.literal("CUSTOMER_CARE_REVIEW_REQUIRED"),
        alternativeAccepted: z.literal(false),
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
  for (const row of data.items) {
    if (row.orderId !== order.id) throw Error("Unexpected supply concern");
    for (const line of row.affectedLines) {
      const item = order.items.find((item) => item.id === line.orderItemId);
      if (!item || line.offset + line.quantity > item.quantity)
        throw Error("Unexpected affected goods");
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
