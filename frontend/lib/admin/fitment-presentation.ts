import type { StaffFitmentRule } from "./parts-fitment";
import { fitmentQualifierKeys } from "@/lib/parts-fitment";

// Mirrors the server's explicit non-critical part-type policy, never a name guess.
export const nonCriticalFitmentTypes = new Set([
  "ACCESSORY",
  "OIL_FILTER",
  "AIR_FILTER",
  "CABIN_FILTER",
  "FUEL_FILTER",
  "SPARK_PLUG",
  "WIPER_BLADE",
  "BULB",
]);
export function fitmentYears(from: number | null, to: number | null) {
  return `${from ?? "Start year missing"} – ${to ?? "end year missing"}`;
}
export function evidenceGaps(rule: StaffFitmentRule) {
  const gaps: string[] = [];
  if (rule.scope === "MODEL") {
    if (!rule.vehicleModelId) gaps.push("Catalogue model needs reconciliation");
    if (rule.yearFrom === null || rule.yearTo === null)
      gaps.push("Model-year range incomplete");
    if (
      rule.safetyCritical &&
      (!rule.position ||
        !rule.brakeSystem ||
        !rule.requiredQualifiers.includes("position") ||
        !rule.requiredQualifiers.includes("brakeSystem"))
    )
      gaps.push("Safety-critical position and brake evidence required");
  }
  if (!rule.sourceReference?.trim()) gaps.push("Evidence source missing");
  if (!rule.evidenceNotes?.trim()) gaps.push("Variant evidence missing");
  if (!rule.allVariantsConfirmed) gaps.push("Full stated coverage not confirmed");
  return gaps;
}
export function primaryFitmentQualifiers(
  productType: string | null,
  rule?: StaffFitmentRule,
) {
  const brake = /BRAKE/.test(productType?.toUpperCase() ?? "");
  return fitmentQualifierKeys.filter(
    (key) =>
      ["engineCode", "generation", "chassisCode"].includes(key) ||
      (brake && ["position", "brakeSystem", "brakeDiameterMm"].includes(key)) ||
      !!rule?.[key] ||
      !!rule?.requiredQualifiers.includes(key) ||
      (!!rule?.safetyCritical && ["position", "brakeSystem"].includes(key)),
  );
}
