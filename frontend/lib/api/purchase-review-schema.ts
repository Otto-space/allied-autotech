import { z } from "zod";
import { fitmentQualifierKeys } from "../parts-fitment";

export const purchaseVehicleSelectionSchema = z
  .object({
    vehicleMakeId: z.uuid().optional(),
    vehicleModelId: z.uuid(),
    year: z.number().int().min(1886).max(2200),
    ...(Object.fromEntries(
      fitmentQualifierKeys.map((key) => [key, z.string().min(1).max(100).optional()]),
    ) as { [Key in (typeof fitmentQualifierKeys)[number]]: z.ZodOptional<z.ZodString> }),
  })
  .strict();
export const purchaseReviewSummarySchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  status: z.enum(["REQUESTED", "APPROVED", "DECLINED"]),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  availability: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ orderItemId: z.uuid(), kind: z.literal("BRANCH_STOCK") }).strict(),
        z
          .object({
            orderItemId: z.uuid(),
            kind: z.literal("SUPPLIER"),
            expectedFrom: z.iso.datetime({ offset: true }),
            expectedTo: z.iso.datetime({ offset: true }),
          })
          .strict()
          .refine(
            (value) => Date.parse(value.expectedFrom) <= Date.parse(value.expectedTo),
            "Invalid arrival range",
          ),
      ]),
    )
    .max(200)
    .default([]),
  requirements: z
    .object({
      lines: z
        .array(
          z
            .object({
              orderItemId: z.uuid(),
              selection: purchaseVehicleSelectionSchema.nullable(),
            })
            .strict(),
        )
        .min(1)
        .max(200),
    })
    .strict(),
});
