import { z } from "zod";
import { fitmentQualifierKeys } from "../parts-fitment";

export const purchaseVehicleSelectionSchema = z
  .object({
    vehicleMakeId: z.uuid().optional(),
    vehicleModelId: z.uuid(),
    year: z.number().int().min(1886).max(2200),
    ...Object.fromEntries(
      fitmentQualifierKeys.map((key) => [key, z.string().min(1).max(100).optional()]),
    ),
  })
  .strict();
export const purchaseReviewSummarySchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  status: z.enum(["REQUESTED", "APPROVED", "DECLINED"]),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
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
