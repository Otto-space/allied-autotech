import { z } from "zod";
import { stockImageSchema } from "./stock-media.schemas.js";
import { savedVehicleCursorSchema } from "./saved-vehicle-cursor.js";

// Keep aligned with publicListingSelect and vehicleJsonSafe. Private stock fields
// (VIN, acquisition costs, document keys) never belong in a saved listing.
export const savedVehicleListingSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  priceKobo: z.string().regex(/^[1-9][0-9]{0,15}$/),
  currency: z.literal("NGN"),
  description: z.string().nullable(),
  featured: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  branch: z.object({
    id: z.uuid(),
    code: z.string(),
    name: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  vehicle: z.object({
    id: z.uuid(),
    stockNumber: z.string(),
    make: z.string(),
    model: z.string(),
    trim: z.string().nullable(),
    year: z.number().int(),
    mileageKm: z.number().int().nullable(),
    transmission: z.string().nullable(),
    fuelType: z.string().nullable(),
    condition: z.string(),
    bodyType: z.string().nullable(),
    engineSize: z.string().nullable(),
    driveType: z.string().nullable(),
    color: z.string().nullable(),
    doors: z.number().int().nullable(),
    seats: z.number().int().nullable(),
    images: z.array(stockImageSchema),
    conditionReports: z
      .array(
        z.object({
          id: z.uuid(),
          odometerKm: z.number().int().nullable(),
          conditionScore: z.number().int().nullable(),
          summary: z.string(),
          findings: z
            .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .nullable(),
          inspectedAt: z.iso.datetime(),
        }),
      )
      .max(1),
  }),
});
export const savedVehiclePageSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        createdAt: z.iso.datetime(),
        vehicleListing: savedVehicleListingSchema,
      }),
    )
    .max(50),
  nextCursor: savedVehicleCursorSchema.optional(),
});
