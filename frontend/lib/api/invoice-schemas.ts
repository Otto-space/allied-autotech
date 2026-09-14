import { z } from "zod";
import { money } from "./commerce-schemas";
export const invoiceSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  currency: z.literal("NGN"),
  status: z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]),
  version: z.number().int(),
  subtotalKobo: money,
  taxKobo: money,
  depositCreditKobo: money,
  totalKobo: money,
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
    }),
  ),
});
export const parseInvoice = (value: unknown) => invoiceSchema.parse(value);
export const parseInvoices = (value: unknown) =>
  z
    .object({ items: z.array(invoiceSchema), nextCursor: z.string().optional() })
    .parse(value);
