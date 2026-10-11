import { z } from "zod";
import { money } from "./commerce-schemas";

export const invoiceDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    invoiceNumber: z.string().min(1).max(50),
    currency: z.literal("NGN"),
    status: z.enum(["ISSUED", "PAID", "VOID"]),
    version: z.number().int().nonnegative(),
    issuedAt: z.string().datetime().nullable(),
    dueAt: z.string().datetime().nullable(),
    paidAt: z.string().datetime().nullable(),
    issuer: z.object({
      name: z.string().min(1).max(200),
      address: z.string().min(1).max(500),
      paymentTerms: z.string().max(1000),
    }),
    billTo: z.object({
      name: z.string().min(1).max(400),
      address: z.string().max(1000).nullable(),
      reference: z.string().uuid(),
    }),
    source: z.object({
      type: z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION"]),
      id: z.string().uuid(),
      reference: z.string().min(1).max(100),
      description: z.string().min(1).max(1000),
    }),
    lines: z
      .array(
        z.object({
          description: z.string().min(1).max(1000),
          quantity: z.number().int().positive().max(1_000_000),
          unitPriceKobo: money,
          subtotalKobo: money,
        }),
      )
      .min(1)
      .max(200),
    discountKobo: money,
    deliveryKobo: money,
    detailBasis: z.enum(["SNAPSHOT", "SOURCE_RECORDS", "LEGACY_SUMMARY"]),
    subtotalKobo: money,
    taxKobo: money,
    depositCreditKobo: money,
    totalKobo: money,
    paymentRequests: z
      .array(
        z.object({
          id: z.string().uuid(),
          paymentNumber: z.string().min(1).max(50),
          amountKobo: money,
          status: z.enum([
            "REQUIRES_PAYMENT",
            "REQUIRES_REVIEW",
            "PROCESSING",
            "SUCCEEDED",
            "CANCELLED",
            "EXPIRED",
          ]),
          succeededAt: z.string().datetime().nullable(),
        }),
      )
      .max(200),
    receipts: z
      .array(
        z.object({
          paymentId: z.string().uuid(),
          paymentNumber: z.string().min(1).max(50),
          amountKobo: money,
          confirmedAt: z.string().datetime(),
          refundedKobo: money,
        }),
      )
      .max(200),
  })
  .superRefine((record, context) => {
    if (
      new Set(record.paymentRequests.map((payment) => payment.id)).size !==
      record.paymentRequests.length
    )
      context.addIssue({ code: "custom", message: "Duplicate payment request" });
    let lines = BigInt(0);
    for (const line of record.lines) {
      if (
        BigInt(line.quantity) * BigInt(line.unitPriceKobo) !==
        BigInt(line.subtotalKobo)
      )
        context.addIssue({ code: "custom", message: "Inconsistent document line" });
      lines += BigInt(line.subtotalKobo);
    }
    if (
      lines - BigInt(record.discountKobo) + BigInt(record.deliveryKobo) !==
        BigInt(record.subtotalKobo) ||
      BigInt(record.subtotalKobo) +
        BigInt(record.taxKobo) -
        BigInt(record.depositCreditKobo) !==
        BigInt(record.totalKobo)
    )
      context.addIssue({ code: "custom", message: "Inconsistent document totals" });
    if (
      new Set(record.receipts.map((receipt) => receipt.paymentId)).size !==
      record.receipts.length
    )
      context.addIssue({ code: "custom", message: "Duplicate receipt" });
  });
export type InvoiceDocument = z.infer<typeof invoiceDocumentSchema>;
