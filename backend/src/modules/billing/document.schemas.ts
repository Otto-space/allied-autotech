import { z } from "zod";

const money = z.string().regex(/^\d{1,19}$/);
const text = (max: number) => z.string().min(1).max(max);
export const documentLineSchema = z.object({
  description: text(1000),
  quantity: z.number().int().min(1).max(1_000_000),
  unitPriceKobo: money,
  subtotalKobo: money,
});
export const invoiceSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  issuer: z.object({
    name: text(200),
    address: text(500),
    paymentTerms: z.string().max(1000),
  }),
  billTo: z.object({
    name: text(400),
    address: z.string().max(1000).nullable(),
    reference: z.uuid(),
  }),
  source: z.object({
    type: z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION"]),
    id: z.uuid(),
    reference: text(100),
    description: text(1000),
  }),
  lines: z.array(documentLineSchema).min(1).max(200),
  discountKobo: money,
  deliveryKobo: money,
  detailBasis: z.enum(["SNAPSHOT", "SOURCE_RECORDS", "LEGACY_SUMMARY"]),
});
export const receiptSummarySchema = z.object({
  paymentId: z.uuid(),
  paymentNumber: text(50),
  amountKobo: money,
  confirmedAt: z.iso.datetime(),
  refundedKobo: money,
});
export const invoiceDocumentSchema = invoiceSnapshotSchema.extend({
  id: z.uuid(),
  invoiceNumber: text(50),
  currency: z.literal("NGN"),
  status: z.enum(["ISSUED", "PAID", "VOID"]),
  version: z.number().int().nonnegative(),
  issuedAt: z.iso.datetime().nullable(),
  dueAt: z.iso.datetime().nullable(),
  paidAt: z.iso.datetime().nullable(),
  subtotalKobo: money,
  taxKobo: money,
  depositCreditKobo: money,
  totalKobo: money,
  receipts: z.array(receiptSummarySchema).max(200),
  paymentRequests: z
    .array(
      z.object({
        id: z.uuid(),
        paymentNumber: text(50),
        amountKobo: money,
        status: z.enum([
          "REQUIRES_PAYMENT",
          "REQUIRES_REVIEW",
          "PROCESSING",
          "SUCCEEDED",
          "CANCELLED",
          "EXPIRED",
        ]),
        succeededAt: z.iso.datetime().nullable(),
      }),
    )
    .max(200),
});
export const receiptDocumentSchema = z.object({
  paymentId: z.uuid(),
  paymentNumber: text(50),
  currency: z.literal("NGN"),
  issuer: invoiceSnapshotSchema.shape.issuer,
  customerReference: z.uuid(),
  amountKobo: money,
  confirmedAt: z.iso.datetime(),
  method: text(80),
  refundedKobo: money,
  source: invoiceSnapshotSchema.shape.source.extend({
    type: z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION", "INVOICE"]),
  }),
});
export type InvoiceSnapshot = z.infer<typeof invoiceSnapshotSchema>;
export type InvoiceDocument = z.infer<typeof invoiceDocumentSchema>;
export type ReceiptDocument = z.infer<typeof receiptDocumentSchema>;
