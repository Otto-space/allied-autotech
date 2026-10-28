/** Only published branch availability is evidence; an empty list is not zero stock. */
export function productAvailability(availability: readonly { inStock: boolean }[]) {
  if (availability.length === 0)
    return { state: "unknown", label: "Availability not listed" } as const;
  if (availability.some((branch) => branch.inStock))
    return { state: "available", label: "In stock at a listed branch" } as const;
  return { state: "unavailable", label: "Unavailable at listed branches" } as const;
}
