import { z } from "zod";

export const partsQuotationSchema = z.object({
  id: z.uuid(),
  enquiryId: z.uuid(),
  revision: z.number().int().positive(),
  productName: z.string(),
  sku: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPriceKobo: z.string().regex(/^\d+$/),
  subtotalKobo: z.string().regex(/^\d+$/),
  taxKobo: z.string().regex(/^\d+$/),
  totalKobo: z.string().regex(/^\d+$/),
  status: z.enum(["ISSUED", "ACCEPTED", "REJECTED", "EXPIRED", "VOID", "DRAFT"]),
  notes: z.string(),
  expiresAt: z.string(),
  orderId: z.uuid().nullable(),
});
