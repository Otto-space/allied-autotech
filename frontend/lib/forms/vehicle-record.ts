import { countryCodes } from "@/lib/reference/countries";
import { z } from "zod";
import type { RequestBody } from "@/lib/api/contracts";
import { vehicleEnums, type StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { nairaToKobo, koboToInput } from "@/lib/format/currency-input";
const text = (max: number) => z.string().trim().max(max);
const integer = (minimum: number, maximum: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number.")
    .refine(
      (value) => Number(value) >= minimum && Number(value) <= maximum,
      `Enter a value from ${minimum} to ${maximum}.`,
    );
const optionalInteger = (min: number, max: number) =>
  z.union([z.literal(""), integer(min, max)]);
export const positiveNaira = z
  .string()
  .trim()
  .regex(
    /^\d{1,14}(?:\.\d{1,2})?$/,
    "Enter a positive NGN amount with up to two decimal places.",
  )
  .refine(
    (value) => !/^0+(?:\.0+)?$/.test(value),
    "The amount must be greater than zero.",
  );
export const recordSchema = z.object({
  branchId: z.string().uuid("Choose a branch."),
  stockNumber: text(40)
    .min(1, "Enter the stock number.")
    .refine(
      (value) => value.toUpperCase().length <= 40,
      "Use at most 40 characters after stock-number capitalization.",
    ),
  make: text(80).min(1, "Enter the make."),
  model: text(80).min(1, "Enter the model."),
  trim: text(80),
  year: integer(1886, new Date().getUTCFullYear() + 1),
  mileageKm: optionalInteger(0, 10000000),
  condition: z.enum(vehicleEnums.condition),
  transmission: z.enum(["", ...vehicleEnums.transmission]),
  fuelType: z.enum(["", ...vehicleEnums.fuelType]),
  bodyType: z.enum(["", ...vehicleEnums.bodyType]),
  driveType: z.enum(["", ...vehicleEnums.driveType]),
  manufactureCountryCode: z
    .string()
    .refine(
      (v) => !v || countryCodes.has(v),
      "Choose a country from the suggestions or clear this field.",
    ),
  powertrain: z.enum(["", ...vehicleEnums.powertrain]),
  engineCapacityCc: optionalInteger(1, 30000),
  features: text(3239).refine((v) => {
    const a = v
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);
    return (
      a.length <= 40 &&
      a.every((f) => f.length <= 80) &&
      new Set(a.map((f) => f.toLowerCase())).size === a.length
    );
  }, "Use up to 40 distinct features, each up to 80 characters, separated by commas."),
  engineCode: text(40).optional(),
  cylinders: optionalInteger(1, 24).optional(),
  ownerReportedCondition: text(2000).optional(),
  ownerReportedIssues: text(4000).optional(),
  engineSize: text(40),
  color: text(40),
  doors: optionalInteger(1, 20),
  seats: optionalInteger(1, 100),
  vin: z.union([
    z.literal(""),
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "Enter a 17-character VIN without I, O or Q."),
  ]),
  chassisNumber: text(80),
  registrationNumber: text(80),
  acquisitionPrice: z.union([z.literal(""), positiveNaira]),
  acquiredAt: z.union([
    z.literal(""),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a valid Lagos date and time.")
      .refine(
        (value) =>
          Number.isFinite(Date.parse(`${value}:00+01:00`)) &&
          new Date(Date.parse(`${value}:00+01:00`) + 3600000)
            .toISOString()
            .slice(0, 16) === value,
        "Choose a valid date and time.",
      ),
  ]),
});
export type VehicleRecordValues = z.infer<typeof recordSchema>;
const nullableNumber = (value: string) => (value === "" ? null : Number(value));
export function vehicleRecordBody(
  value: VehicleRecordValues,
  includeAcquisition = true,
  existing?: StaffVehicle,
): Omit<RequestBody<"/staff/vehicles", "post">, "branchId" | "stockNumber"> {
  return {
    make: value.make,
    model: value.model,
    trim: value.trim || null,
    year: Number(value.year),
    mileageKm: nullableNumber(value.mileageKm),
    condition: value.condition,
    transmission: value.transmission || null,
    fuelType: value.fuelType || null,
    bodyType: value.bodyType || null,
    driveType: value.driveType || null,
    manufactureCountryCode: value.manufactureCountryCode || null,
    powertrain: value.powertrain || null,
    engineCapacityCc: nullableNumber(value.engineCapacityCc),
    features: value.features
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    ...(value.engineCode !== undefined ? { engineCode: value.engineCode || null } : {}),
    ...(value.cylinders !== undefined
      ? { cylinders: nullableNumber(value.cylinders) }
      : {}),
    ...(value.ownerReportedCondition !== undefined
      ? { ownerReportedCondition: value.ownerReportedCondition || null }
      : {}),
    ...(value.ownerReportedIssues !== undefined
      ? { ownerReportedIssues: value.ownerReportedIssues || null }
      : {}),
    engineSize: value.engineSize || null,
    color: value.color || null,
    doors: nullableNumber(value.doors),
    seats: nullableNumber(value.seats),
    vin: value.vin || null,
    chassisNumber: value.chassisNumber || null,
    registrationNumber: value.registrationNumber || null,
    ...(includeAcquisition
      ? {
          acquisitionCostKobo: value.acquisitionPrice
            ? nairaToKobo(value.acquisitionPrice)
            : null,
        }
      : {}),
    acquiredAt:
      existing && value.acquiredAt === vehicleDefaults(existing).acquiredAt
        ? existing.acquiredAt
        : value.acquiredAt
          ? `${value.acquiredAt}:00+01:00`
          : null,
  };
}
// The editor presents minutes; an unchanged field must retain the exact saved instant.
export function vehicleRecordUpdateBody(
  value: VehicleRecordValues,
  vehicle: StaffVehicle,
  includeAcquisition = true,
) {
  return {
    ...vehicleRecordBody(value, includeAcquisition, vehicle),
    expectedVersion: vehicle.version,
  };
}
export function vehicleDefaults(
  vehicle?: StaffVehicle,
  branchId = "",
): VehicleRecordValues {
  const candidate: VehicleRecordValues = {
    branchId: vehicle?.branchId ?? branchId,
    stockNumber: vehicle?.stockNumber ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    trim: vehicle?.trim ?? "",
    year: vehicle ? String(vehicle.year) : "",
    mileageKm: vehicle?.mileageKm?.toString() ?? "",
    condition: vehicle?.condition ?? "USED",
    transmission: vehicle?.transmission ?? "",
    fuelType: vehicle?.fuelType ?? "",
    bodyType: vehicle?.bodyType ?? "",
    driveType: vehicle?.driveType ?? "",
    manufactureCountryCode: vehicle?.manufactureCountryCode ?? "",
    powertrain: vehicle?.powertrain ?? "",
    engineCapacityCc: vehicle?.engineCapacityCc?.toString() ?? "",
    features: vehicle?.features?.join(", ") ?? "",
    engineCode: vehicle?.engineCode ?? "",
    cylinders: vehicle?.cylinders?.toString() ?? "",
    ownerReportedCondition: vehicle?.ownerReportedCondition ?? "",
    ownerReportedIssues: vehicle?.ownerReportedIssues ?? "",
    engineSize: vehicle?.engineSize ?? "",
    color: vehicle?.color ?? "",
    doors: vehicle?.doors?.toString() ?? "",
    seats: vehicle?.seats?.toString() ?? "",
    vin: vehicle?.vin ?? "",
    chassisNumber: vehicle?.chassisNumber ?? "",
    registrationNumber: vehicle?.registrationNumber ?? "",
    acquisitionPrice:
      vehicle?.acquisitionCostKobo == null
        ? ""
        : koboToInput(vehicle.acquisitionCostKobo),
    acquiredAt: vehicle?.acquiredAt
      ? new Date(Date.parse(vehicle.acquiredAt) + 3600000).toISOString().slice(0, 16)
      : "",
  };
  return candidate;
}
