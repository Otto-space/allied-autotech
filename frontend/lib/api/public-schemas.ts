import { z } from "zod";
export const serviceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]),
  priceKobo: z.string().regex(/^\d+$/).nullable(),
  currency: z.literal("NGN"),
  durationMinutes: z.number().nullable(),
  version: z.number(),
});
export const servicePageSchema = z.object({
  items: z.array(serviceSchema),
  nextCursor: z.string().optional(),
});
export const parseServices = (value: unknown) => servicePageSchema.parse(value);
