import { z } from "zod";
const money = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/);
export const promotionSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    code: z.string().nullable(),
    description: z.string().nullable(),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
    percentageBasisPoints: z.number().int().min(1).max(10000).nullable(),
    fixedAmountKobo: money.nullable(),
    minimumOrderAmountKobo: money.nullable(),
    maximumDiscountAmountKobo: money.nullable(),
    usageLimit: z.number().int().positive().nullable(),
    perCustomerLimit: z.number().int().positive().nullable(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    isActive: z.boolean(),
    version: z.number().int().nonnegative(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .refine((value) =>
    value.discountType === "PERCENTAGE"
      ? value.percentageBasisPoints !== null && value.fixedAmountKobo === null
      : value.fixedAmountKobo !== null && value.percentageBasisPoints === null,
  );
export type Promotion = z.infer<typeof promotionSchema>;
export const parsePromotion = (value: unknown) => promotionSchema.parse(value);
export const parsePromotions = (value: unknown) =>
  z
    .object({ items: z.array(promotionSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const parsePromotionPreview = (value: unknown) =>
  z.object({ code: z.string(), discountAmountKobo: money }).parse(value);
