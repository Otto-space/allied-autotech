import { z } from "zod";
import { transactionStatuses } from "./vehicle-schemas";
import { money } from "./commerce-schemas";
const purchase = z.object({
  id: z.uuid(),
  transactionNumber: z.string().min(1),
  status: z.enum(transactionStatuses),
  askingPriceKobo: money,
  agreedPriceKobo: money.nullable(),
  currency: z.literal("NGN"),
  createdAt: z.iso.datetime({ offset: true }),
  vehicleListing: z.object({
    id: z.uuid(),
    title: z.string().min(1),
    vehicle: z
      .object({
        images: z.array(
          z.object({
            id: z.uuid(),
            url: z.string(),
            altText: z.string().nullable(),
            isPrimary: z.boolean(),
          }),
        ),
      })
      .optional(),
  }),
});
const page = z.object({
  items: z
    .array(purchase)
    .max(50)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  nextCursor: z.uuid().optional(),
});
export type CustomerPurchase = z.infer<typeof purchase>;
export const parseCustomerPurchases = (value: unknown) => page.parse(value);
