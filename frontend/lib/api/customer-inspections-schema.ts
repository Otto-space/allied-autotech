import { z } from "zod";
import { inspectionStatuses } from "../customer-inspection-query";
const date = z.iso.datetime({ offset: true });
const inspection = z.object({
  id: z.uuid(),
  status: z.enum(inspectionStatuses),
  preferredStartAt: date,
  preferredEndAt: date.nullable(),
  scheduledStartAt: date.nullable(),
  scheduledEndAt: date.nullable(),
  notes: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  vehicleListing: z.object({ id: z.uuid(), title: z.string().min(1) }),
  conditionReport: z
    .object({
      summary: z.string(),
      inspectedAt: date,
      odometerKm: z.number().int().min(0).max(10_000_000).nullable(),
      conditionScore: z.number().int().min(0).max(100).nullable(),
      findings: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .nullable(),
    })
    .nullable(),
});
const page = z.object({
  items: z
    .array(inspection)
    .max(50)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  nextCursor: z.uuid().optional(),
});
export type CustomerInspection = z.infer<typeof inspection>;
export const parseCustomerInspections = (value: unknown) => page.parse(value);
