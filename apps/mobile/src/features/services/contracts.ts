import { z } from "zod";
import { asKoboString, formatNaira } from "../../money";

// Runtime projection of publicServiceSchema in the existing backend OpenAPI.
// Unknown fields are stripped; no private/staff fields are consumed here.
export const serviceSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  shortDescription: z.string().nullable(),
  pricingType: z.enum(["FIXED", "QUOTE_REQUIRED"]),
  priceKobo: z
    .string()
    .regex(/^(?:0|[1-9][0-9]*)$/)
    .refine((value) => value.trim() === value)
    .nullable(),
  currency: z.literal("NGN"),
  durationMinutes: z.number().int().nonnegative().nullable(),
  isActive: z.literal(true),
});
export const servicesSchema = z.object({
  items: z.array(serviceSchema),
  nextCursor: z.uuid().optional(),
});
export type CatalogueService = z.infer<typeof serviceSchema>;

export function servicePrice(service: CatalogueService): string {
  if (service.pricingType === "QUOTE_REQUIRED") return "Quote required";
  return service.priceKobo === null
    ? "Price unavailable"
    : formatNaira(asKoboString(service.priceKobo));
}
