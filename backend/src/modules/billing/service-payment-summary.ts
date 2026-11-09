import { serviceInvoiceBooking } from "./service-invoice-context.js";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  acceptedServiceStageSchema,
  hasServiceFinancialHold,
  servicePaymentPlanFromSnapshot,
  serviceStagePaid,
} from "./service-payment-plan.js";

const money = z.string().regex(/^(0|[1-9]\d{0,18})$/);
export const servicePaymentReadSelect = {
  status: true,
  amountKobo: true,
  policySnapshot: true,
  settledAttempt: {
    select: {
      refunds: { select: { status: true } },
      disputes: { select: { status: true } },
    },
  },
  anomalies: {
    where: { status: { in: ["OPEN", "INVESTIGATING"] } },
    take: 1,
    select: { status: true },
  },
  attempts: {
    where: {
      OR: [
        { status: { in: ["INITIALIZED", "PENDING", "PROCESSING"] } },
        { status: "SUCCESSFUL", payment: { status: { not: "SUCCEEDED" } } },
      ],
    },
    take: 1,
    select: { id: true },
  },
} as const satisfies Prisma.PaymentSelect;
const stage = z.strictObject({ totalKobo: money, recordedKobo: money });
export const servicePaymentSummarySchema = z.strictObject({
  materials: stage,
  workmanship: stage,
  workCompleted: z.boolean(),
  financialReviewRequired: z.boolean(),
  paymentPending: z.boolean(),
  nextPayment: acceptedServiceStageSchema.nullable(),
});
type SummaryInvoice = {
  documentSnapshot: unknown;
  subtotalKobo: bigint;
  taxKobo: bigint;
  depositCreditKobo: bigint;
  totalKobo: bigint;
  version: number;
  status: string;
  booking: { status: string; completedAt: Date | null } | null;
  additionalQuote?: {
    booking: { status: string; completedAt: Date | null };
    originalInvoice?: {
      status: string;
      payments: Parameters<typeof hasServiceFinancialHold>[0];
    } | null;
  } | null;
  payments: readonly {
    status: string;
    amountKobo: bigint;
    policySnapshot: unknown;
    attempts?: readonly unknown[];
    anomalies?: readonly { status: string }[];
    settledAttempt?: {
      refunds: readonly { status: string }[];
      disputes: readonly { status: string }[];
    } | null;
  }[];
};

/** Minimal customer/staff projection. No policy IDs, private binding or actor data. */
export function servicePaymentSummary(invoice: SummaryInvoice) {
  const plan = servicePaymentPlanFromSnapshot(invoice.documentSnapshot, invoice);
  if (!plan) return null;
  const paid = serviceStagePaid(plan, invoice.payments);
  const original = invoice.additionalQuote?.originalInvoice;
  const financialReviewRequired =
    hasServiceFinancialHold(invoice.payments) ||
    (!!invoice.additionalQuote &&
      (!original ||
        !["ISSUED", "PAID"].includes(original.status) ||
        hasServiceFinancialHold(original.payments)));
  const paymentPending = invoice.payments.some(
    (payment) =>
      !["SUCCEEDED", "CANCELLED", "EXPIRED"].includes(payment.status) ||
      (payment.attempts?.length ?? 0) > 0,
  );
  const booking = serviceInvoiceBooking(invoice);
  const workCompleted = booking?.status === "COMPLETED" && booking.completedAt !== null;
  const materialsDue = BigInt(plan.materials.totalKobo) - paid.MATERIALS;
  const workmanshipDue = BigInt(plan.workmanship.totalKobo) - paid.WORKMANSHIP;
  let nextPayment: z.infer<typeof acceptedServiceStageSchema> | null = null;
  if (
    invoice.status === "ISSUED" &&
    booking?.status !== "CANCELLED" &&
    !financialReviewRequired &&
    !paymentPending
  ) {
    if (materialsDue > 0n)
      nextPayment = {
        stage: "MATERIALS",
        invoiceVersion: invoice.version,
        amountKobo: materialsDue.toString(),
      };
    else if (workCompleted && workmanshipDue > 0n)
      nextPayment = {
        stage: "WORKMANSHIP",
        invoiceVersion: invoice.version,
        amountKobo: workmanshipDue.toString(),
      };
  }
  return servicePaymentSummarySchema.parse({
    materials: {
      totalKobo: plan.materials.totalKobo,
      recordedKobo: paid.MATERIALS.toString(),
    },
    workmanship: {
      totalKobo: plan.workmanship.totalKobo,
      recordedKobo: paid.WORKMANSHIP.toString(),
    },
    workCompleted,
    financialReviewRequired,
    paymentPending,
    nextPayment,
  });
}
