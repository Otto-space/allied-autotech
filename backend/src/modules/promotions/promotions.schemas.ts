import { z } from "zod";

const uuid = z.uuid();
const version = z.number().int().min(0).max(2_147_483_647);
const cleanText = (maximum: number) => z.string().trim().min(1).max(maximum);
const kobo = z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/, "Use integer kobo");
const optionalBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const promotionFields = {
  name: cleanText(160),
  code: cleanText(80)
    .transform((value) => value.toUpperCase())
    .nullable()
    .optional(),
  description: cleanText(2_000).nullable().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  percentageBasisPoints: z.number().int().min(1).max(10_000).nullable().optional(),
  fixedAmountKobo: kobo.nullable().optional(),
  minimumOrderAmountKobo: kobo.nullable().optional(),
  maximumDiscountAmountKobo: kobo.nullable().optional(),
  usageLimit: z.number().int().min(1).max(10_000_000).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).max(100_000).nullable().optional(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  isActive: z.boolean().default(true),
} as const;

function validPromotion(value: Record<string, unknown>, context: z.RefinementCtx): void {
  if (
    new Date(String(value["endsAt"])).getTime() <=
    new Date(String(value["startsAt"])).getTime()
  )
    context.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "Must follow startsAt",
    });
  if (
    value["discountType"] === "PERCENTAGE" &&
    (value["percentageBasisPoints"] == null || value["fixedAmountKobo"] != null)
  )
    context.addIssue({
      code: "custom",
      path: ["percentageBasisPoints"],
      message: "Percentage promotions require basis points only",
    });
  if (
    value["discountType"] === "FIXED_AMOUNT" &&
    (value["fixedAmountKobo"] == null || value["percentageBasisPoints"] != null)
  )
    context.addIssue({
      code: "custom",
      path: ["fixedAmountKobo"],
      message: "Fixed promotions require a fixed amount only",
    });
  if (
    typeof value["usageLimit"] === "number" &&
    typeof value["perCustomerLimit"] === "number" &&
    value["perCustomerLimit"] > value["usageLimit"]
  )
    context.addIssue({
      code: "custom",
      path: ["perCustomerLimit"],
      message: "Cannot exceed usageLimit",
    });
}

export const promotionParamsSchema = z.object({ promotionId: uuid }).strict();
export const promotionListQuerySchema = z
  .object({
    cursor: uuid.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    isActive: optionalBoolean,
  })
  .strict();
export const promotionPreviewBodySchema = z
  .object({
    code: cleanText(80).transform((value) => value.toUpperCase()),
    subtotalKobo: kobo,
  })
  .strict();
export const promotionCreateBodySchema = z
  .object(promotionFields)
  .strict()
  .superRefine(validPromotion);
export const promotionUpdateBodySchema = z
  .object({
    expectedVersion: version,
    name: promotionFields.name.optional(),
    code: promotionFields.code,
    description: promotionFields.description,
    discountType: promotionFields.discountType.optional(),
    percentageBasisPoints: promotionFields.percentageBasisPoints,
    fixedAmountKobo: promotionFields.fixedAmountKobo,
    minimumOrderAmountKobo: promotionFields.minimumOrderAmountKobo,
    maximumDiscountAmountKobo: promotionFields.maximumDiscountAmountKobo,
    usageLimit: promotionFields.usageLimit,
    perCustomerLimit: promotionFields.perCustomerLimit,
    startsAt: promotionFields.startsAt.optional(),
    endsAt: promotionFields.endsAt.optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, "At least one change is required");

export type PromotionListQuery = z.infer<typeof promotionListQuerySchema>;
export type PromotionCreateInput = z.infer<typeof promotionCreateBodySchema>;
export type PromotionUpdateInput = z.infer<typeof promotionUpdateBodySchema>;
export type PromotionPreviewInput = z.infer<typeof promotionPreviewBodySchema>;
