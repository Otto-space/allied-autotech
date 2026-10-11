import { z } from "zod";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";
import { publicVehicleListQuerySchema } from "./vehicles.schemas.js";
import { savedVehicleListingSchema } from "./saved-vehicle.schemas.js";

const pageSize = z
  .string()
  .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
  .default("20")
  .transform(Number);
export const vehicleDiscoveryQuerySchema = publicVehicleListQuerySchema.safeExtend({
  cursor: z.union([z.uuid(), catalogueCursorSchema]).optional(),
  limit: pageSize,
  year: z
    .string()
    .regex(/^\d{4}$/)
    .transform(Number)
    .pipe(z.number().int().min(1886).max(2200))
    .optional(),
});
export type VehicleDiscoveryQuery = z.infer<typeof vehicleDiscoveryQuerySchema>;
export const vehicleDiscoveryPageSchema = z.object({
  items: z.array(savedVehicleListingSchema).max(50),
  nextCursor: catalogueCursorSchema.optional(),
  totalMatches: z.number().int().min(0),
});
export const vehicleFacetQuerySchema = z
  .object({
    field: z.enum(["make", "model"]),
    make: z.string().trim().min(1).max(80).optional(),
    search: z.string().trim().min(1).max(80).optional(),
    cursor: catalogueCursorSchema.optional(),
    limit: pageSize,
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.field === "model") !== (value.make !== undefined))
      ctx.addIssue({
        code: "custom",
        path: ["make"],
        message: "Specify make only when requesting model options",
      });
  });
export type VehicleFacetQuery = z.infer<typeof vehicleFacetQuerySchema>;
export const vehicleFacetPageSchema = z.object({
  items: z
    .array(
      z.object({ value: z.string().min(1).max(80), label: z.string().min(1).max(80) }),
    )
    .max(50),
  nextCursor: catalogueCursorSchema.optional(),
});
