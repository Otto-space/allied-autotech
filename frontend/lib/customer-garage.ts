import { z } from "zod";
import { customerVehicleSchema } from "./api/vehicle-schemas";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const garageVehicleSchema = customerVehicleSchema.extend({
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().int().min(1886),
  mileageKm: z.number().int().min(0).max(5000000).nullable(),
});
export const parseGarageVehicles = (value: unknown) =>
  z
    .object({
      vehicles: z.array(garageVehicleSchema).max(100),
      nextCursor: z.uuid().optional(),
    })
    .transform(({ vehicles, nextCursor }) => ({ items: vehicles, nextCursor }))
    .parse(value);

export function garageQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  const limit = input.get("limit") ?? "20";
  const cursor = input.get("cursor");
  const validLimit = ["10", "20", "50"].includes(limit);
  const invalid = !validLimit || !!(cursor && !uuid.test(cursor));
  params.set("limit", validLimit ? limit : "20");
  if (cursor && uuid.test(cursor)) params.set("cursor", cursor);
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length > 0 &&
    trail.length <= 50 &&
    trail[0] === "start" &&
    trail.slice(1).every((v) => uuid.test(v))
  )
    params.set("_trail", trail.join(","));
  const api = new URLSearchParams(params);
  api.delete("_trail");
  return { params, invalid, path: `/customers/vehicles?${api}` };
}

export type GarageFields = Record<
  "make" | "model" | "year" | "registrationNumber" | "color" | "vin" | "mileageKm",
  string
>;
export function garageFieldError(name: keyof GarageFields, raw: string): true | string {
  const value = raw.trim();
  if ((name === "make" || name === "model") && !value) return `Enter the ${name}.`;
  if (["make", "model", "color"].includes(name)) {
    const max = name === "color" ? 50 : 80;
    if (value.length > max) return `Use ${max} characters or fewer.`;
    if ([...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127))
      return "Remove control characters.";
  }
  if (
    name === "year" &&
    (!/^\d{4}$/.test(value) ||
      Number(value) < 1886 ||
      Number(value) > new Date().getUTCFullYear() + 1)
  )
    return `Enter a whole year from 1886 to ${new Date().getUTCFullYear() + 1}.`;
  if (
    name === "registrationNumber" &&
    value &&
    !/^[A-Z0-9][A-Z0-9 -]{1,19}$/i.test(value)
  )
    return "Use 2–20 letters, numbers, spaces or hyphens.";
  if (name === "vin" && value && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(value))
    return "Enter a 17-character VIN without I, O or Q.";
  if (name === "mileageKm" && value && (!/^\d+$/.test(value) || Number(value) > 5000000))
    return "Enter a whole number from 0 to 5,000,000.";
  return true;
}
export function garageBody(values: GarageFields) {
  for (const key of Object.keys(values) as (keyof GarageFields)[]) {
    const error = garageFieldError(key, values[key]);
    if (error !== true) throw new Error(error);
  }
  return {
    make: values.make.trim(),
    model: values.model.trim(),
    year: Number(values.year.trim()),
    registrationNumber: values.registrationNumber.trim().toUpperCase() || null,
    color: values.color.trim() || null,
    vin: values.vin.trim().toUpperCase() || null,
    mileageKm: values.mileageKm.trim() ? Number(values.mileageKm.trim()) : null,
  };
}
