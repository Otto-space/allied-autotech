import { z } from "zod";
import { validSearch } from "../../common/security/catalogue-search.js";
import { catalogueCursorSchema } from "../../common/security/catalogue-cursors.js";
import {
  publicVehicleListQueryBase,
  checkPublicVehicleQuery,
} from "./vehicles.schemas.js";
import { savedVehicleListingSchema } from "./saved-vehicle.schemas.js";

const pageSize = z
  .string()
  .regex(/^(?:[1-9]|[1-4][0-9]|50)$/)
  .default("20")
  .transform(Number);
export const vehicleDiscoveryQuerySchema = publicVehicleListQueryBase
  .extend({
    sort: z
      .enum([
        "best_match",
        "newest",
        "price_asc",
        "price_desc",
        "year_desc",
        "year_asc",
        "mileage_asc",
        "mileage_desc",
      ])
      .optional(),
    cursor: z.union([z.uuid(), catalogueCursorSchema]).optional(),
    limit: pageSize,
    year: z
      .string()
      .regex(/^\d{4}$/)
      .transform(Number)
      .pipe(z.number().int().min(1886).max(2200))
      .optional(),
  })
  .superRefine(checkPublicVehicleQuery)
  .refine((q) => !q.search || validSearch(q.search), {
    path: ["search"],
    message: "Use between 1 and 20 searchable words or codes",
  })
  .transform((q) => ({
    ...q,
    sort:
      q.sort === "best_match" && !q.search
        ? ("newest" as const)
        : (q.sort ?? (q.search ? ("best_match" as const) : ("newest" as const))),
  }));
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
