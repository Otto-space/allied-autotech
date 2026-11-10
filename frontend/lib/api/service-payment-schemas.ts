import { z } from "zod";
import { money } from "./commerce-schemas";

export const serviceStage = z.enum(["MATERIALS", "WORKMANSHIP"]);
const stageAmounts = z.object({ totalKobo: money, recordedKobo: money }).strict();
export const servicePaymentSummarySchema = z
  .object({
    materials: stageAmounts,
    workmanship: stageAmounts,
    workCompleted: z.boolean(),
    financialReviewRequired: z.boolean(),
    paymentPending: z.boolean(),
    nextPayment: z
      .object({
        stage: serviceStage,
        invoiceVersion: z.number().int().nonnegative(),
        amountKobo: money,
      })
      .strict()
      .nullable(),
  })
  .strict();
export type ServicePaymentSummary = z.infer<typeof servicePaymentSummarySchema>;
export function servicePaymentDocumentMatches(
  invoice: {
    servicePayment?: ServicePaymentSummary;
    additionalQuote?: {
      id: string;
      amendmentReason: string;
      originalInvoice: { invoiceNumber: string };
    } | null;
  },
  document: {
    source?: {
      type: string;
      id: string;
      originalInvoiceNumber?: string;
      amendmentReason?: string;
    };
    servicePaymentPlan?: {
      materials: { totalKobo: string };
      workmanship: { totalKobo: string };
    };
  },
) {
  const summary = invoice.servicePayment,
    plan = document.servicePaymentPlan;
  return (
    (invoice.additionalQuote
      ? document.source?.type === "SERVICE_ADDITION" &&
        document.source.id === invoice.additionalQuote.id &&
        document.source.originalInvoiceNumber ===
          invoice.additionalQuote.originalInvoice.invoiceNumber &&
        document.source.amendmentReason === invoice.additionalQuote.amendmentReason
      : document.source?.type !== "SERVICE_ADDITION") &&
    Boolean(summary) === Boolean(plan) &&
    (!summary ||
      (!!plan &&
        summary.materials.totalKobo === plan.materials.totalKobo &&
        summary.workmanship.totalKobo === plan.workmanship.totalKobo))
  );
}

export function validateServicePaymentSummary(
  invoice: {
    servicePayment?: ServicePaymentSummary;
    totalKobo: string;
    version: number;
    status: string;
    booking: unknown;
    additionalQuote?: unknown;
  },
  context: z.RefinementCtx,
) {
  const summary = invoice.servicePayment;
  if (!summary) return;
  const m = BigInt(summary.materials.totalKobo),
    w = BigInt(summary.workmanship.totalKobo);
  const mp = BigInt(summary.materials.recordedKobo),
    wp = BigInt(summary.workmanship.recordedKobo);
  const next = summary.nextPayment;
  if (
    (!invoice.booking && !invoice.additionalQuote) ||
    m + w !== BigInt(invoice.totalKobo) ||
    mp > m ||
    wp > w ||
    (next &&
      (invoice.status !== "ISSUED" ||
        next.invoiceVersion !== invoice.version ||
        summary.financialReviewRequired ||
        summary.paymentPending ||
        BigInt(next.amountKobo) <= BigInt(0) ||
        BigInt(next.amountKobo) !== (next.stage === "MATERIALS" ? m - mp : w - wp) ||
        (next.stage === "WORKMANSHIP" && (!summary.workCompleted || mp !== m))))
  ) {
    context.addIssue({
      code: "custom",
      path: ["servicePayment"],
      message: "Service payment amounts need refresh and review",
    });
  }
}

const allocated = {
  subtotalKobo: money,
  taxKobo: money,
  creditKobo: money,
  totalKobo: money,
};
export const servicePaymentPlanSchema = z
  .object({
    version: z.literal(1),
    quoteId: z.uuid(),
    quoteVersion: z.number().int().positive(),
    rule: z.literal("SAVED_QUOTE_TOTALS_LARGEST_REMAINDER"),
    feeTiming: z.literal("DEFER_UNTIL_WORK_COMPLETED"),
    materials: z.object(allocated).strict(),
    workmanship: z.object(allocated).strict(),
    lines: z
      .array(
        z.object({ quoteItemId: z.uuid(), stage: serviceStage, ...allocated }).strict(),
      )
      .min(1)
      .max(200),
  })
  .strict()
  .superRefine((plan, context) => {
    const fail = () =>
      context.addIssue({
        code: "custom",
        message: "Service invoice allocation is inconsistent",
      });
    if (new Set(plan.lines.map((l) => l.quoteItemId)).size !== plan.lines.length) fail();
    for (const line of plan.lines)
      if (
        BigInt(line.subtotalKobo) + BigInt(line.taxKobo) - BigInt(line.creditKobo) !==
        BigInt(line.totalKobo)
      )
        fail();
    for (const [key, value] of [
      ["MATERIALS", plan.materials],
      ["WORKMANSHIP", plan.workmanship],
    ] as const)
      for (const field of Object.keys(allocated) as (keyof typeof allocated)[])
        if (
          plan.lines
            .filter((l) => l.stage === key)
            .reduce((sum, l) => sum + BigInt(l[field]), BigInt(0)) !==
          BigInt(value[field])
        )
          fail();
  });
