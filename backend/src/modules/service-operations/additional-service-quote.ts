import type { Prisma } from "../../generated/prisma/client.js";
import {
  serviceOperationConflict,
  staleServiceOperation,
} from "./service-operations.errors.js";

export type AdditionalQuoteContext = {
  originalInvoiceId: string;
  amendmentReason: string;
};

/** Caller already owns the Booking row lock and has checked authoring scope. */
export async function newQuoteContext(
  tx: Prisma.TransactionClient,
  booking: { id: string; version: number },
  additional?: { expectedBookingVersion: number; reason: string },
): Promise<AdditionalQuoteContext | null> {
  if (additional && additional.expectedBookingVersion !== booking.version)
    throw staleServiceOperation();
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "bookingId" = ${booking.id}::uuid FOR SHARE`;
  const invoice = await tx.invoice.findUnique({
    where: { bookingId: booking.id },
    select: { id: true, status: true },
  });
  if (!invoice) {
    if (additional)
      throw serviceOperationConflict(
        "Issue the original service invoice before preparing additional work",
      );
    return null;
  }
  if (!additional)
    throw serviceOperationConflict(
      "The original scope has an invoice. Choose Additional work and give a reason; do not replace its agreed amount",
    );
  if (!["ISSUED", "PAID"].includes(invoice.status))
    throw serviceOperationConflict(
      "The original service invoice needs review before additional work can be quoted",
    );
  return { originalInvoiceId: invoice.id, amendmentReason: additional.reason };
}

export async function savedQuoteContext(
  tx: Prisma.TransactionClient,
  bookingId: string,
  quoteId: string,
): Promise<AdditionalQuoteContext | null> {
  const quote = await tx.serviceQuote.findFirstOrThrow({
    where: { id: quoteId, bookingId },
    select: { originalInvoiceId: true, amendmentReason: true },
  });
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "bookingId" = ${bookingId}::uuid FOR SHARE`;
  const invoice = await tx.invoice.findUnique({
    where: { bookingId },
    select: { id: true, status: true },
  });
  if (!quote.originalInvoiceId) {
    if (invoice)
      throw serviceOperationConflict(
        "The original scope already has an invoice; prepare an explicit additional-work quotation",
      );
    return null;
  }
  if (
    !invoice ||
    invoice.id !== quote.originalInvoiceId ||
    !quote.amendmentReason ||
    !["ISSUED", "PAID"].includes(invoice.status)
  )
    throw serviceOperationConflict(
      "Review the original invoice before changing or accepting this additional work",
    );
  return { originalInvoiceId: invoice.id, amendmentReason: quote.amendmentReason };
}
