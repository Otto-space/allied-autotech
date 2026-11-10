import { vehicleLabel } from "@/lib/vehicle-discovery";
import { engineLitres } from "@/lib/vehicle-presentation";

type EngineFacts = {
  powertrain?: string | null;
  fuelType?: string | null;
  transmission?: string | null;
  driveType?: string | null;
  engineCapacityCc?: number | null;
  cylinders?: number | null;
  engineCode?: string | null;
  engineSize?: string | null;
  engineDetails?: string | null;
};
export function VehicleEngineSummary({
  vehicle,
  className,
}: {
  vehicle: EngineFacts;
  className?: string;
}) {
  const facts = [
    ["Engine / Power type", vehicle.powertrain && vehicleLabel(vehicle.powertrain)],
    ["Fuel type", vehicle.fuelType && vehicleLabel(vehicle.fuelType)],
    ["Drive system", vehicle.driveType && vehicleLabel(vehicle.driveType)],
    ["Transmission", vehicle.transmission && vehicleLabel(vehicle.transmission)],
    [
      "Engine capacity",
      vehicle.engineCapacityCc != null
        ? `${engineLitres(vehicle.engineCapacityCc)} (${vehicle.engineCapacityCc.toLocaleString("en-NG")} cc)`
        : null,
    ],
    ["Cylinders", vehicle.cylinders],
    ["Engine code", vehicle.engineCode],
    ["Engine size", vehicle.engineCapacityCc == null ? vehicle.engineSize : null],
    ["Engine details", vehicle.engineDetails],
  ].filter(([, value]) => value != null && value !== "");
  if (!facts.length) return null;
  return (
    <section aria-label="Engine & drive">
      <h3>Engine &amp; drive</h3>
      <dl className={className}>
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="preserve-lines">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
