import { assertAdditionalWorkOpen } from "../service-operations/additional-service-quote.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { invoiceConflict } from "./billing.errors.js";
import {
  hasServiceFinancialHold,
  servicePaymentPlanFromSnapshot,
} from "./service-payment-plan.js";
const originalPaymentSelect = {
  status: true,
  anomalies: {
    where: { status: { in: ["OPEN", "INVESTIGATING"] } },
    select: { status: true },
  },
  settledAttempt: {
    select: {
      id: true,
      refunds: { select: { status: true } },
      disputes: { select: { status: true } },
    },
  },
} satisfies Prisma.PaymentSelect;

export const serviceBookingSelect = {
  id: true,
  status: true,
  completedAt: true,
  branch: { select: { id: true, code: true, name: true } },
} as const;
export const additionalInvoiceQuoteSelect = {
  id: true,
  quoteNumber: true,
  amendmentReason: true,
  originalInvoice: {
    select: {
      invoiceNumber: true,
      status: true,
      payments: { select: originalPaymentSelect },
    },
  },
  booking: { select: serviceBookingSelect },
} as const;
export function serviceInvoiceBooking<T>(invoice: {
  booking: T | null;
  additionalQuote?: { booking: T } | null;
}): T | null {
  return invoice.booking ?? invoice.additionalQuote?.booking ?? null;
}

/** Same operational lock order for original and supplemental invoices. */
export async function lockServiceInvoiceBooking(
  tx: Prisma.TransactionClient,
  invoiceId: string,
) {
  const source = await tx.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      bookingId: true,
      additionalQuote: { select: { bookingId: true } },
    },
  });
  const bookingId = source?.bookingId ?? source?.additionalQuote?.bookingId;
  if (bookingId)
    await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id"=${bookingId}::uuid FOR UPDATE`;
}

/** Called under Booking -> Invoice locks. No original payment/credit is reused. */
export async function assertSupplementalInvoiceCurrent(
  tx: Prisma.TransactionClient,
  invoiceId: string,
) {
  const row = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: {
      additionalQuoteId: true,
      status: true,
      additionalQuote: {
        select: {
          status: true,
          acceptedAt: true,
          acceptedAdditionalContext: true,
          version: true,
          amendmentReason: true,
          booking: {
            select: { id: true, status: true, customer: { select: { userId: true } } },
          },
          originalInvoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              documentSnapshot: true,
              subtotalKobo: true,
              taxKobo: true,
              totalKobo: true,
              depositCreditKobo: true,
              payments: { select: originalPaymentSelect },
            },
          },
        },
      },
    },
  });
  if (!row.additionalQuoteId) return;
  const q = row.additionalQuote,
    original = q?.originalInvoice;
  if (q && row.status === "DRAFT") await assertAdditionalWorkOpen(tx, q.booking.id);
  if (original) {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id"=${original.id}::uuid FOR SHARE`;
    const proofs = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT a."id" FROM "PaymentAttempt" a JOIN "Payment" p ON p."settledAttemptId"=a."id" WHERE p."invoiceId"=${original.id}::uuid ORDER BY a."id" FOR SHARE OF a SKIP LOCKED`;
    const locked = new Set(proofs.map((p) => p.id));
    if (
      original.payments.some((p) => p.settledAttempt && !locked.has(p.settledAttempt.id))
    )
      throw invoiceConflict(
        "Original payment verification is busy; reload before preparing additional work",
      );
    const current = await tx.invoice.findUniqueOrThrow({
      where: { id: original.id },
      select: { status: true, payments: { select: originalPaymentSelect } },
    });
    if (
      !["ISSUED", "PAID"].includes(current.status) ||
      hasServiceFinancialHold(current.payments) ||
      current.payments.some((p) => p.settledAttempt && !locked.has(p.settledAttempt.id))
    )
      throw invoiceConflict(
        "Review the original financial adjustments before proceeding with additional work",
      );
  }
  if (
    !q ||
    !original ||
    q.status !== "ACCEPTED" ||
    !q.acceptedAt ||
    !q.amendmentReason ||
    !["ISSUED", "PAID"].includes(original.status) ||
    q.booking.status === "CANCELLED" ||
    hasServiceFinancialHold(original.payments)
  )
    throw invoiceConflict(
      "Review the original agreement and financial adjustments before proceeding with additional work",
    );
  if (!servicePaymentPlanFromSnapshot(original.documentSnapshot, original))
    throw invoiceConflict(
      "The historical original invoice needs financial review before staged additional work can be billed",
    );
  const consent = q.acceptedAdditionalContext;
  if (
    !consent ||
    typeof consent !== "object" ||
    Array.isArray(consent) ||
    consent["kind"] !== "ADDITIONAL_WORK" ||
    consent["invoiceNumber"] !== original.invoiceNumber ||
    consent["quoteVersion"] !== q.version ||
    consent["reason"] !== q.amendmentReason ||
    consent["customerUserId"] !== q.booking.customer.userId
  )
    throw invoiceConflict(
      "The current additional-work agreement needs explicit customer acknowledgement",
    );
}
