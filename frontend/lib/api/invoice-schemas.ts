import { z } from "zod";
import { money } from "./commerce-schemas";
import {
  servicePaymentSummarySchema,
  serviceStage,
  validateServicePaymentSummary,
} from "./service-payment-schemas";
export const invoiceSchema = z
  .object({
    id: z.string().uuid(),
    invoiceNumber: z.string(),
    currency: z.literal("NGN"),
    status: z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]),
    version: z.number().int(),
    subtotalKobo: money,
    taxKobo: money,
    depositCreditKobo: money,
    totalKobo: money,
    servicePayment: servicePaymentSummarySchema.optional(),
    additionalQuote: z
      .object({
        id: z.uuid(),
        quoteNumber: z.string().min(1),
        amendmentReason: z.string().trim().min(1).max(1000),
        originalInvoice: z.object({ invoiceNumber: z.string().min(1).max(50) }),
        booking: z.object({ id: z.uuid() }),
      })
      .nullable()
      .optional(),
    issuedAt: z.string().nullable(),
    dueAt: z.string().nullable(),
    paidAt: z.string().nullable(),
    createdAt: z.string(),
    order: z.object({ id: z.string().uuid(), orderNumber: z.string() }).nullable(),
    booking: z.object({ id: z.string().uuid() }).nullable(),
    vehicleTransaction: z
      .object({ id: z.string().uuid(), transactionNumber: z.string() })
      .nullable(),
    payments: z.array(
      z.object({
        id: z.string().uuid(),
        paymentNumber: z.string(),
        status: z.string(),
        amountKobo: money,
        succeededAt: z.string().nullable(),
        serviceStage: serviceStage.optional(),
      }),
    ),
  })
  .superRefine(validateServicePaymentSummary)
  .superRefine((record, context) => {
    if (
      record.additionalQuote &&
      (record.order ||
        record.booking ||
        record.vehicleTransaction ||
        record.depositCreditKobo !== "0" ||
        !record.servicePayment)
    )
      context.addIssue({
        code: "custom",
        message: "The separate additional invoice has conflicting source or credit facts",
      });
  });
export const parseInvoice = (value: unknown) => invoiceSchema.parse(value);
export const parseInvoices = (value: unknown) =>
  z
    .object({ items: z.array(invoiceSchema), nextCursor: z.string().optional() })
    .parse(value);
