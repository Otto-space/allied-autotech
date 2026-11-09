import { z } from "zod";

export const sourcingLabels = {
  UNKNOWN: "Not yet confirmed",
  IN_STOCK: "In stock",
  SUPPLIER_CONFIRMED: "Supplier confirmed",
  ORDERED: "Ordered from supplier",
  IN_TRANSIT: "In transit",
  ARRIVED: "Arrived at Allied",
  UNAVAILABLE: "Unavailable — contact the team",
} as const;
export const timingLineSchema = z
  .object({
    orderItemId: z.uuid(),
    sourcingStatus: z.enum(
      Object.keys(sourcingLabels) as [
        keyof typeof sourcingLabels,
        ...(keyof typeof sourcingLabels)[],
      ],
    ),
    sourcingFrom: z.iso.datetime({ offset: true }).nullable(),
    sourcingUntil: z.iso.datetime({ offset: true }).nullable(),
    preparationMinutes: z.number().int().min(0).max(525600).nullable(),
  })
  .strict()
  .superRefine((line, ctx) => {
    if (
      ["UNKNOWN", "IN_STOCK", "ARRIVED", "UNAVAILABLE"].includes(line.sourcingStatus) &&
      line.sourcingFrom !== null
    )
      ctx.addIssue({
        code: "custom",
        message: "Only a sourced item has an arrival estimate.",
      });

    if (
      (line.sourcingFrom === null) !== (line.sourcingUntil === null) ||
      (line.sourcingFrom &&
        line.sourcingUntil &&
        Date.parse(line.sourcingFrom) > Date.parse(line.sourcingUntil))
    )
      ctx.addIssue({
        code: "custom",
        message: "Enter both ends of an ordered arrival estimate, or leave both blank.",
      });
  });
export const timingUpdatesSchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        orderVersion: z.number().int().nonnegative(),
        lines: z.array(timingLineSchema).min(1).max(200),
        customerNote: z.string().min(1).max(1000),
        createdAt: z.iso.datetime({ offset: true }),
      })
      .strict(),
  )
  .max(1)
  .optional()
  .default([]);
export type TimingUpdate = z.infer<typeof timingUpdatesSchema>[number];

export function timingSignature(lines: z.infer<typeof timingLineSchema>[]) {
  return JSON.stringify(
    lines
      .map((line) => [
        line.orderItemId,
        line.sourcingStatus,
        line.sourcingFrom,
        line.sourcingUntil,
        line.preparationMinutes,
      ])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
}
