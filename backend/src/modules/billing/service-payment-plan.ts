import { z } from "zod";
import { allocateKobo } from "../orders/order-money-allocation.js";
import { invoiceConflict } from "./billing.errors.js";

const money = z
  .string()
  .regex(/^(0|[1-9]\d{0,18})$/)
  .refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n);
export const servicePaymentStageSchema = z.enum(["MATERIALS", "WORKMANSHIP"]);
export type ServicePaymentStage = z.infer<typeof servicePaymentStageSchema>;
export const acceptedServiceStageSchema = z.strictObject({
  stage: servicePaymentStageSchema,
  invoiceVersion: z.number().int().min(0).max(2_147_483_647),
  amountKobo: money,
});
export const servicePaymentBindingSchema = acceptedServiceStageSchema.extend({
  quoteId: z.uuid(),
  quoteVersion: z.number().int().positive(),
});
export type ServicePaymentBinding = z.infer<typeof servicePaymentBindingSchema>;
const amounts = {
  subtotalKobo: money,
  taxKobo: money,
  creditKobo: money,
  totalKobo: money,
};
const lineSchema = z.strictObject({
  quoteItemId: z.uuid(),
  stage: servicePaymentStageSchema,
  ...amounts,
});

/** A split of one already agreed sale, never two independently rounded invoices. */
export const servicePaymentPlanSchema = z
  .strictObject({
    version: z.literal(1),
    quoteId: z.uuid(),
    quoteVersion: z.number().int().positive(),
    rule: z.literal("SAVED_QUOTE_TOTALS_LARGEST_REMAINDER"),
    feeTiming: z.literal("DEFER_UNTIL_WORK_COMPLETED"),
    materials: z.strictObject(amounts),
    workmanship: z.strictObject(amounts),
    lines: z.array(lineSchema).min(1).max(200),
  })
  .superRefine((plan, context) => {
    const invalid = () =>
      context.addIssue({
        code: "custom",
        message: "Service payment allocation is inconsistent",
      });
    if (new Set(plan.lines.map((line) => line.quoteItemId)).size !== plan.lines.length)
      invalid();
    for (const line of plan.lines) {
      if (
        BigInt(line.subtotalKobo) + BigInt(line.taxKobo) - BigInt(line.creditKobo) !==
        BigInt(line.totalKobo)
      )
        invalid();
    }
    for (const stage of ["MATERIALS", "WORKMANSHIP"] as const) {
      const saved = stage === "MATERIALS" ? plan.materials : plan.workmanship;
      const lines = plan.lines.filter((line) => line.stage === stage);
      for (const field of Object.keys(amounts) as (keyof typeof amounts)[]) {
        if (
          lines.reduce((sum, line) => sum + BigInt(line[field]), 0n) !==
          BigInt(saved[field])
        )
          invalid();
      }
    }
  });
export type ServicePaymentPlan = z.infer<typeof servicePaymentPlanSchema>;

type QuoteLine = {
  id: string;
  type: "PART" | "LABOUR" | "FEE";
  quantity: number;
  unitPriceKobo: bigint;
  subtotalKobo: bigint;
};
type InvoiceTotals = {
  subtotalKobo: bigint;
  taxKobo: bigint;
  depositCreditKobo: bigint;
  totalKobo: bigint;
};

export function assertServicePaymentPlanTotals(
  plan: ServicePaymentPlan,
  invoice: InvoiceTotals,
) {
  const fields = {
    subtotalKobo: invoice.subtotalKobo,
    taxKobo: invoice.taxKobo,
    creditKobo: invoice.depositCreditKobo,
    totalKobo: invoice.totalKobo,
  };
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    if (
      BigInt(plan.materials[field]) + BigInt(plan.workmanship[field]) !==
      fields[field]
    ) {
      throw invoiceConflict("Service payment stages must reconcile to the saved invoice");
    }
  }
}

/** Caller supplies accepted quote items in immutable createdAt/id order. Existing
 * invoices are never retrofitted. VAT/credit amounts are allocated, not recomputed.
 * PART is materials; labour and fees are deferred until completion. This deliberately
 * does not treat a fee as a material purchase or activate procurement/payment policy. */
export function buildServicePaymentPlan(
  quote: { id: string; version: number; items: readonly QuoteLine[] },
  invoice: InvoiceTotals,
): ServicePaymentPlan {
  if (
    quote.items.length < 1 ||
    quote.items.length > 200 ||
    quote.items.some(
      (line) =>
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        !["PART", "LABOUR", "FEE"].includes(line.type) ||
        line.unitPriceKobo < 0n ||
        line.subtotalKobo !== line.unitPriceKobo * BigInt(line.quantity),
    ) ||
    quote.items.reduce((sum, line) => sum + line.subtotalKobo, 0n) !==
      invoice.subtotalKobo ||
    invoice.taxKobo < 0n ||
    (invoice.subtotalKobo === 0n && invoice.taxKobo !== 0n) ||
    invoice.depositCreditKobo < 0n ||
    invoice.depositCreditKobo > invoice.subtotalKobo + invoice.taxKobo ||
    invoice.totalKobo !==
      invoice.subtotalKobo + invoice.taxKobo - invoice.depositCreditKobo
  ) {
    throw invoiceConflict(
      "Accepted service quote cannot supply a consistent payment plan",
    );
  }
  const taxes = allocateKobo(
    invoice.taxKobo,
    quote.items.map((line) => line.subtotalKobo),
  );
  const gross = quote.items.map((line, index) => line.subtotalKobo + taxes[index]!);
  const credits = allocateKobo(invoice.depositCreditKobo, gross);
  const lines = quote.items.map((line, index) => ({
    quoteItemId: line.id,
    stage: line.type === "PART" ? ("MATERIALS" as const) : ("WORKMANSHIP" as const),
    subtotalKobo: line.subtotalKobo.toString(),
    taxKobo: taxes[index]!.toString(),
    creditKobo: credits[index]!.toString(),
    totalKobo: (gross[index]! - credits[index]!).toString(),
  }));
  const totalStage = (stage: ServicePaymentStage) =>
    Object.fromEntries(
      (Object.keys(amounts) as (keyof typeof amounts)[]).map((field) => [
        field,
        lines
          .filter((line) => line.stage === stage)
          .reduce((sum, line) => sum + BigInt(line[field]), 0n)
          .toString(),
      ]),
    );
  const parsed = servicePaymentPlanSchema.safeParse({
    version: 1,
    quoteId: quote.id,
    quoteVersion: quote.version,
    rule: "SAVED_QUOTE_TOTALS_LARGEST_REMAINDER",
    feeTiming: "DEFER_UNTIL_WORK_COMPLETED",
    materials: totalStage("MATERIALS"),
    workmanship: totalStage("WORKMANSHIP"),
    lines,
  });
  if (!parsed.success)
    throw invoiceConflict("Accepted service payment allocation is invalid");
  assertServicePaymentPlanTotals(parsed.data, invoice);
  return parsed.data;
}

export function servicePaymentPlanFromSnapshot(
  snapshot: unknown,
  invoice: InvoiceTotals,
): ServicePaymentPlan | null {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    !("servicePaymentPlan" in snapshot)
  )
    return null;
  const parsed = servicePaymentPlanSchema.safeParse(snapshot.servicePaymentPlan);
  if (!parsed.success)
    throw invoiceConflict("The saved service payment plan needs staff review");
  assertServicePaymentPlanTotals(parsed.data, invoice);
  return parsed.data;
}

export function servicePaymentBinding(snapshot: unknown): ServicePaymentBinding | null {
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    !("servicePayment" in snapshot)
  )
    return null;
  const parsed = servicePaymentBindingSchema.safeParse(snapshot.servicePayment);
  if (!parsed.success)
    throw invoiceConflict("The service payment request needs staff review");
  return parsed.data;
}

/** Count authoritative settled intents once. Refunds/disputes are separate financial
 * exceptions: never turn a refund into an automatic authorization to charge again. */
export function serviceStagePaid(
  plan: ServicePaymentPlan,
  payments: readonly { status: string; amountKobo: bigint; policySnapshot: unknown }[],
) {
  const paid = { MATERIALS: 0n, WORKMANSHIP: 0n };
  for (const payment of payments) {
    if (payment.status !== "SUCCEEDED") continue;
    const binding = servicePaymentBinding(payment.policySnapshot);
    if (
      !binding ||
      binding.quoteId !== plan.quoteId ||
      binding.quoteVersion !== plan.quoteVersion ||
      BigInt(binding.amountKobo) !== payment.amountKobo ||
      payment.amountKobo <= 0n
    ) {
      throw invoiceConflict(
        "A settled payment does not match the saved service payment plan",
      );
    }
    paid[binding.stage] += payment.amountKobo;
  }
  if (
    paid.MATERIALS > BigInt(plan.materials.totalKobo) ||
    paid.WORKMANSHIP > BigInt(plan.workmanship.totalKobo)
  ) {
    throw invoiceConflict("Service payments exceed their agreed stage allocation");
  }
  return paid;
}

export function serviceStagePayable(
  plan: ServicePaymentPlan,
  paid: ReturnType<typeof serviceStagePaid>,
  stage: ServicePaymentStage,
  workCompleted: boolean,
): bigint {
  const agreed = stage === "MATERIALS" ? plan.materials : plan.workmanship;
  if (
    stage === "WORKMANSHIP" &&
    (!workCompleted || paid.MATERIALS !== BigInt(plan.materials.totalKobo))
  ) {
    throw invoiceConflict(
      "Workmanship is payable after completion and settlement of required materials",
    );
  }
  const due = BigInt(agreed.totalKobo) - paid[stage];
  if (due <= 0n)
    throw invoiceConflict("This service payment stage has no outstanding amount");
  return due;
}

export function hasServiceFinancialHold(
  payments: readonly {
    status: string;
    anomalies?: readonly { status: string }[];
    settledAttempt?: {
      refunds: readonly { status: string }[];
      disputes: readonly { status: string }[];
    } | null;
  }[],
) {
  return payments.some(
    (payment) =>
      payment.status === "REQUIRES_REVIEW" ||
      payment.anomalies?.some((anomaly) =>
        ["OPEN", "INVESTIGATING"].includes(anomaly.status),
      ) ||
      payment.settledAttempt?.refunds.some(
        (refund) => !["FAILED", "CANCELLED"].includes(refund.status),
      ) ||
      payment.settledAttempt?.disputes.some((dispute) => dispute.status !== "WON"),
  );
}
