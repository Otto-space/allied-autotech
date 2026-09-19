import { z } from "zod";
import {
  vehicleImageSchema,
  vehicleDocumentSchema,
  conditionSummarySchema,
} from "./vehicle-document-schemas";
export const vehicleEnums = {
  condition: ["NEW", "USED"],
  transmission: ["AUTOMATIC", "MANUAL", "CVT", "OTHER"],
  fuelType: ["PETROL", "DIESEL", "HYBRID", "ELECTRIC", "OTHER"],
  bodyType: [
    "SEDAN",
    "SUV",
    "COUPE",
    "HATCHBACK",
    "WAGON",
    "PICKUP",
    "VAN",
    "TRUCK",
    "BUS",
    "OTHER",
  ],
  driveType: ["FWD", "RWD", "AWD", "FOUR_WD", "OTHER"],
} as const;
export const listingStatuses = [
  "DRAFT",
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "INACTIVE",
  "ARCHIVED",
] as const;
const money = z.string().regex(/^\d+$/);
export const staffListingSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  priceKobo: money,
  currency: z.literal("NGN"),
  description: z.string().nullable(),
  status: z.enum(listingStatuses),
  featured: z.boolean(),
  version: z.number().int(),
  publishedAt: z.string().nullable(),
  reservedAt: z.string().nullable(),
  soldAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
});
export const staffVehicleSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  stockNumber: z.string(),
  make: z.string(),
  model: z.string(),
  trim: z.string().nullable(),
  year: z.number().int(),
  mileageKm: z.number().int().nullable(),
  transmission: z.enum(vehicleEnums.transmission).nullable(),
  fuelType: z.enum(vehicleEnums.fuelType).nullable(),
  condition: z.enum(vehicleEnums.condition),
  bodyType: z.enum(vehicleEnums.bodyType).nullable(),
  engineSize: z.string().nullable(),
  driveType: z.enum(vehicleEnums.driveType).nullable(),
  color: z.string().nullable(),
  doors: z.number().int().nullable(),
  seats: z.number().int().nullable(),
  vin: z.string().nullable(),
  chassisNumber: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  acquisitionCostKobo: money.nullable().optional(),
  acquisitionCurrency: z.literal("NGN").optional(),
  acquiredAt: z.string().datetime({ offset: true }).nullable(),
  version: z.number().int(),
  branch: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    isActive: z.boolean(),
  }),
  listings: z.array(staffListingSchema),
  images: z.array(vehicleImageSchema),
  documents: z.array(vehicleDocumentSchema),
  conditionReports: z.array(conditionSummarySchema),
});
export type StaffVehicle = z.infer<typeof staffVehicleSchema>;
export type StaffListing = z.infer<typeof staffListingSchema>;
export const parseStaffVehicle = (value: unknown) => staffVehicleSchema.parse(value);
export const parseAdminVehicle = (value: unknown) =>
  staffVehicleSchema
    .extend({
      acquisitionCostKobo: money.nullable(),
      acquisitionCurrency: z.literal("NGN"),
    })
    .parse(value);
export const parseStaffVehicles = (value: unknown) =>
  z
    .object({ items: z.array(staffVehicleSchema), nextCursor: z.string().optional() })
    .parse(value);
