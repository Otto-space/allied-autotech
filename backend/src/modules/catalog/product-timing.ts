import { z } from "zod";

// Estimates are elapsed calendar days/minutes, never stock or collection authority.
export const productTimingFields = {
  sourcingDaysMin: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .nullable()
    .optional()
    .describe(
      "Minimum estimated elapsed calendar days if sourcing is needed. Set both bounds, or clear both. This does not confirm stock or collection readiness.",
    ),
  sourcingDaysMax: z
    .number()
    .int()
    .min(0)
    .max(3650)
    .nullable()
    .optional()
    .describe(
      "Maximum estimated elapsed calendar days, at least the minimum. Unknown timing is null; zero is a recorded estimate.",
    ),
  preparationMinutes: z
    .number()
    .int()
    .min(0)
    .max(525600)
    .nullable()
    .optional()
    .describe(
      "Estimated preparation minutes once the item is available, separately from sourcing and the order's actual collection-ready time. Null means unknown.",
    ),
};
export function validProductTiming(value: {
  sourcingDaysMin?: number | null | undefined;
  sourcingDaysMax?: number | null | undefined;
}) {
  if (value.sourcingDaysMin === undefined && value.sourcingDaysMax === undefined)
    return true;
  if (value.sourcingDaysMin === undefined || value.sourcingDaysMax === undefined)
    return false;
  return value.sourcingDaysMin === null || value.sourcingDaysMax === null
    ? value.sourcingDaysMin === null && value.sourcingDaysMax === null
    : value.sourcingDaysMin <= value.sourcingDaysMax;
}
