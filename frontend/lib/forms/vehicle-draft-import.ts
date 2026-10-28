import { z } from "zod";
import { vehicleEnums } from "../api/staff-vehicle-schemas";
import {
  recordSchema,
  vehicleDefaults,
  type VehicleRecordValues,
} from "./vehicle-record";

// Portable stock preparation, never a publication command. Price, branch and
// lifecycle are deliberately outside this contract and require their own review.
export const vehicleDraftImportSchema = z
  .object({
    format: z.literal("allied-vehicle-stock-draft-v1"),
    stockNumber: z.string().trim().min(1).max(40),
    vehicle: z
      .object({
        make: z.string().trim().min(1).max(80),
        model: z.string().trim().min(1).max(80),
        year: z
          .number()
          .int()
          .min(1886)
          .max(new Date().getUTCFullYear() + 1),
        engineCapacityCc: z.number().int().min(1).max(30000).optional(),
        engineCode: z.string().trim().min(1).max(40).optional(),
        cylinders: z.number().int().min(1).max(24).optional(),
        bodyType: z.enum(vehicleEnums.bodyType).optional(),
        doors: z.number().int().min(1).max(20).optional(),
        driveType: z.enum(vehicleEnums.driveType).optional(),
        ownerReportedCondition: z.string().trim().min(1).max(2000).optional(),
        ownerReportedIssues: z.string().trim().min(1).max(4000).optional(),
      })
      .strict(),
  })
  .strict();

export function importVehicleDraft(
  value: unknown,
  branchId: string,
): VehicleRecordValues {
  const draft = vehicleDraftImportSchema.parse(value);
  const values = vehicleDefaults(undefined, branchId);
  values.stockNumber = draft.stockNumber;
  for (const [key, field] of Object.entries(draft.vehicle))
    (values as Record<string, unknown>)[key] = String(field);
  // No fabricated mileage, price, branch, country, fuel or transmission.
  return recordSchema.parse(values);
}
