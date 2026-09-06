import { z } from "zod";
const uuid = z.uuid();
const version = z.number().int().min(0).max(2_147_483_647);
const pageFields = {
  cursor: uuid.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
} as const;
const status = z.enum(["DRAFT", "ISSUED", "PAID", "VOID"]);
export const invoiceParamsSchema = z.object({ invoiceId: uuid }).strict();
export const billingEmptyQuerySchema = z.object({}).strict().default({});
export const customerInvoiceListQuerySchema = z
  .object({ ...pageFields, status: z.enum(["ISSUED", "PAID", "VOID"]).optional() })
  .strict();
export const staffInvoiceListQuerySchema = z
  .object({
    ...pageFields,
    status: status.optional(),
    customerId: uuid.optional(),
    branchId: uuid.optional(),
  })
  .strict();
export const invoiceCreateBodySchema = z
  .object({
    sourceType: z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION"]),
    sourceId: uuid,
    dueAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export const invoiceTransitionBodySchema = z
  .object({ expectedVersion: version })
  .strict();
export type CustomerInvoiceListQuery = z.infer<typeof customerInvoiceListQuerySchema>;
export type StaffInvoiceListQuery = z.infer<typeof staffInvoiceListQuerySchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateBodySchema>;
export type InvoiceTransitionInput = z.infer<typeof invoiceTransitionBodySchema>;
