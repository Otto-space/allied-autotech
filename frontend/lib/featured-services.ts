// Editorial discovery only. Catalogue price, identity and booking eligibility remain authoritative.
export const featuredServices = [
  {
    key: "diagnostics",
    name: "Comprehensive Vehicle Diagnostics",
    image: "diagnostics-at-work",
    alt: "Allied technician inspecting an open engine bay",
    description: "A full vehicle health check with a PDF copy of the scan result.",
  },
  {
    key: "alignment",
    name: "Wheel Alignment",
    image: "alignment-at-work",
    alt: "Allied technician beside 3D wheel alignment equipment",
    description: "3D alignment correction of all four wheels.",
  },
  {
    key: "oil-service",
    name: "Generic Lube Oil Service",
    image: "oil-service",
    alt: "Illustration of oil being poured into a vehicle engine",
    description: "Lube oil change, plus air-filter and AC-filter cleaning.",
  },
] as const;
export function serviceInterest(value: string | null) {
  return featuredServices.find((item) => item.key === value);
}
