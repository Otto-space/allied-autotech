import { vehicleLabel } from "./vehicle-discovery";

type VehicleIdentity = {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  engineCapacityCc?: number | null;
  doors?: number | null;
  bodyType?: string | null;
  mileageKm?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  cylinders?: number | null;
  engineCode?: string | null;
};

/** Display litres without rounding away the recorded cc precision. */
export function engineLitres(cc: number | null | undefined): string | undefined {
  if (cc == null || !Number.isInteger(cc) || cc <= 0) return undefined;
  return `${(cc / 1000).toLocaleString("en-NG", { minimumFractionDigits: 1, maximumFractionDigits: 3 })} L`;
}

export function vehiclePresentation(vehicle: VehicleIdentity) {
  const title = [
    vehicle.year,
    vehicle.make.trim(),
    vehicle.model.trim(),
    vehicle.trim?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  const body = vehicle.bodyType
    ? vehicleLabel(vehicle.bodyType).toLowerCase()
    : undefined;
  const subtitle = [
    engineLitres(vehicle.engineCapacityCc),
    body ? `${vehicle.doors ? `${vehicle.doors}-door ` : ""}${body}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const specs = [
    vehicle.mileageKm != null
      ? `${vehicle.mileageKm.toLocaleString("en-NG")} km`
      : undefined,
    vehicle.transmission ? vehicleLabel(vehicle.transmission) : undefined,
    vehicle.fuelType ? vehicleLabel(vehicle.fuelType) : undefined,
    vehicle.cylinders != null ? `${vehicle.cylinders} cylinders` : undefined,
    vehicle.engineCode || undefined,
  ].filter((value): value is string => !!value);
  return { title, subtitle, specs };
}
