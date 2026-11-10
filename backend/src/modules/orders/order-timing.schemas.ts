import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        [...value].every(
          (character) =>
            (character.codePointAt(0) ?? 0) > 31 && character.codePointAt(0) !== 127,
        ),
      "Use one paragraph without control characters",
    );
export const orderTimingLineSchema = z
  .object({
    orderItemId: z.uuid(),
    sourcingStatus: z.enum([
      "UNKNOWN",
      "IN_STOCK",
      "SUPPLIER_CONFIRMED",
      "ORDERED",
      "IN_TRANSIT",
      "ARRIVED",
      "UNAVAILABLE",
    ]),
    sourcingFrom: z.iso.datetime({ offset: true }).nullable(),
    sourcingUntil: z.iso.datetime({ offset: true }).nullable(),
    preparationMinutes: z.number().int().min(0).max(525600).nullable(),
  })
  .strict()
  .superRefine((line, ctx) => {
    if (
      (line.sourcingFrom === null) !== (line.sourcingUntil === null) ||
      (line.sourcingFrom !== null &&
        line.sourcingUntil !== null &&
        Date.parse(line.sourcingFrom) > Date.parse(line.sourcingUntil))
    )
      ctx.addIssue({
        code: "custom",
        path: ["sourcingUntil"],
        message:
          "Provide both ends of an ordered sourcing estimate, or leave both unknown",
      });
    if (
      ["UNKNOWN", "IN_STOCK", "ARRIVED", "UNAVAILABLE"].includes(line.sourcingStatus) &&
      line.sourcingFrom !== null
    )
      ctx.addIssue({
        code: "custom",
        path: ["sourcingFrom"],
        message: "Only a sourced item has an arrival estimate",
      });
  });
export const orderTimingBodySchema = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483647),
    idempotencyKey: z.uuid(),
    lines: z
      .array(orderTimingLineSchema)
      .min(1)
      .max(200)
      .refine(
        (lines) => new Set(lines.map((line) => line.orderItemId)).size === lines.length,
        "Each order item must occur exactly once",
      ),
    customerNote: text(1000),
    reason: text(1000),
  })
  .strict();
export type OrderTimingInput = z.infer<typeof orderTimingBodySchema>;
