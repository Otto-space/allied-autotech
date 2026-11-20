import { z } from "zod";

export const productTimingFields = {
  sourcingDaysMin: z.number().int().min(0).max(3650).nullable().optional(),
  sourcingDaysMax: z.number().int().min(0).max(3650).nullable().optional(),
  preparationMinutes: z.number().int().min(0).max(525600).nullable().optional(),
};
type Timing = {
  sourcingDaysMin?: number | null;
  sourcingDaysMax?: number | null;
  preparationMinutes?: number | null;
};
// Older catalogue responses omit these keys entirely; explicit nulls belong to
// the newer contract and mean unknown estimates, not lack of support.
export function supportsProductTiming(value: Timing | null | undefined) {
  return (
    value != null &&
    Object.keys(productTimingFields).every((key) => Object.hasOwn(value, key))
  );
}
export function productTimingLabels(value: Timing) {
  const min = value.sourcingDaysMin,
    max = value.sourcingDaysMax;
  return {
    sourcing:
      min != null && max != null && min <= max
        ? `${min === max ? min : `${min}–${max}`} calendar ${max === 1 ? "day" : "days"}`
        : null,
    preparation:
      value.preparationMinutes != null
        ? `${value.preparationMinutes} ${value.preparationMinutes === 1 ? "minute" : "minutes"}`
        : null,
  };
}
