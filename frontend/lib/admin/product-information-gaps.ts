import type { AdminProduct } from "./product-catalogue";

/** Editorial checklist only: publication and compatibility authority stay server-side. */
export function productInformationGaps(record: AdminProduct) {
  const missing: string[] = [];
  if (!record.family) missing.push("Product family");
  if (!record.brand?.trim()) missing.push("Brand");
  if (!record.manufacturerPartNumber?.trim()) missing.push("Manufacturer part number");
  if (!record.description?.trim()) missing.push("Description");
  if (!record.images.length) missing.push("Genuine product photographs");
  if (record.family === "ENGINE_OIL") {
    if (!record.oilViscosityGrade) missing.push("Oil viscosity grade");
    if (record.packVolumeMl == null) missing.push("Pack volume");
  } else {
    if (!record.condition) missing.push("Condition");
    if (!record.classification) missing.push("OEM or aftermarket classification");
    if (
      !record.compatibilities.some(
        (rule) => rule.reviewStatus === "APPROVED" && rule.effect === "INCLUDE",
      )
    )
      missing.push("Reviewed vehicle compatibility evidence");
  }
  return missing;
}
