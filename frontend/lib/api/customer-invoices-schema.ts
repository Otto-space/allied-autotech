import { z } from "zod";
import { invoiceSchema } from "./invoice-schemas";

const customerInvoice = invoiceSchema.extend({
  status: z.enum(["ISSUED", "PAID", "VOID"]),
  issuedAt: z.iso.datetime({ offset: true }).nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
const customerInvoices = z.object({
  items: z.array(customerInvoice),
  nextCursor: z.uuid().optional(),
});
export const parseCustomerInvoices = (value: unknown) => customerInvoices.parse(value);
