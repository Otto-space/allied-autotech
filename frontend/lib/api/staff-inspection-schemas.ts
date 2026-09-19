import { z } from "zod";
import { conditionSummarySchema } from "./vehicle-document-schemas";
export const inspectionStatuses = [
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "RESCHEDULED",
  "CANCELLED",
  "NO_SHOW",
] as const;
export const inspectionTransitions = {
  REQUESTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "RESCHEDULED", "CANCELLED", "NO_SHOW"],
  RESCHEDULED: ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
} as const;
export const staffInspectionSchema = z.object({
  id: z.string().uuid(),
  customerName: z.string(),
  assignedStaffId: z.string().uuid().nullable(),
  status: z.enum(inspectionStatuses),
  version: z.number().int(),
  preferredStartAt: z.string(),
  preferredEndAt: z.string().nullable(),
  scheduledStartAt: z.string().nullable(),
  scheduledEndAt: z.string().nullable(),
  notes: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
  vehicleListing: z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    branchId: z.string().uuid(),
    vehicle: z.object({
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      stockNumber: z.string(),
    }),
  }),
  assignedStaff: z
    .object({ id: z.string().uuid(), firstName: z.string(), lastName: z.string() })
    .nullable(),
  conditionReport: conditionSummarySchema.nullable(),
});
export type StaffInspection = z.infer<typeof staffInspectionSchema>;
export const parseStaffInspections = (value: unknown) =>
  z
    .object({ items: z.array(staffInspectionSchema), nextCursor: z.string().optional() })
    .parse(value);
