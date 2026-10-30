/** Owner-approved service areas, 30 October 2026. Import into ServiceCategory;
 * this is authoring input, never a second customer-facing catalogue. */
export const ownerServiceGroups = [
  {
    slug: "tyre-wheel-maintenance",
    name: "Tyre & Wheel Maintenance",
    description: "Maintenance for vehicle tyres and wheels.",
  },
  {
    slug: "vehicle-diagnostics-inspections",
    name: "Vehicle Diagnostics & Inspections",
    description:
      "Diagnostics and inspections to understand your vehicle's condition and concerns.",
  },
  {
    slug: "ecu-programming-vehicle-electronics",
    name: "ECU Programming & Vehicle Electronics",
    description:
      "Work involving the vehicle's electronic control unit (ECU), or vehicle computer, and electronics.",
  },
  {
    slug: "suspension-repairs",
    name: "Suspension Repairs",
    description: "Assessment and repairs for vehicle suspension concerns.",
  },
  {
    slug: "engine-drive-system-maintenance",
    name: "Engine & Drive System Maintenance",
    description: "Maintenance for the engine and drive system.",
  },
  {
    slug: "vehicle-ac-maintenance",
    name: "Vehicle AC Maintenance",
    description: "Maintenance for vehicle air conditioning.",
  },
  {
    slug: "bodywork-painting",
    name: "Bodywork & Painting",
    description: "Vehicle bodywork and painting enquiries.",
  },
  {
    slug: "interior-repairs",
    name: "Interior Repairs",
    description: "Repairs for vehicle interiors.",
  },
] as const;

type ExistingCategory = { id: string; slug: string; name: string };
const normalise = (value: string) =>
  value.trim().toLocaleLowerCase("en-NG").replace(/\s+/g, " ");
/** Plan before authorised writes. Preserve IDs/slugs; ambiguity needs explicit mapping.
 * Including inactive categories prevents accidentally recreating hidden records. */
export function planOwnerServiceGroups(existing: readonly ExistingCategory[]) {
  return ownerServiceGroups.map((group, sortOrder) => {
    const matches = existing.filter(
      (row) => row.slug === group.slug || normalise(row.name) === normalise(group.name),
    );
    if (matches.length > 1)
      throw new Error("Ambiguous existing service category: " + group.slug);
    const row = matches[0];
    return {
      ...group,
      sortOrder,
      action: row ? ("reuse" as const) : ("create" as const),
      id: row?.id ?? null,
      slug: row?.slug ?? group.slug,
    };
  });
}
