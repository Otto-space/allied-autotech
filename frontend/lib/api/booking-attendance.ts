import { z } from "zod";
export const attendanceKinds = [
  "ARRIVED",
  "WAITING",
  "LEFT",
  "ABSENCE_CONFIRMED",
] as const;
export const attendanceEventSchema = z.object({
  id: z.uuid(),
  kind: z.enum(attendanceKinds),
  reason: z.string().max(1000),
  createdAt: z.iso.datetime(),
  bookingVersion: z.number().int(),
  scheduleVersion: z.number().int(),
  graceMinutes: z.number().int().nullable(),
  graceSource: z.enum(["DELEGATED_DEFAULT", "APPROVED_BRANCH_POLICY"]).nullable(),
});
export type AttendanceEvent = z.infer<typeof attendanceEventSchema>;
export const attendanceSnapshotSchema = z.object({
  bookingId: z.uuid(),
  bookingVersion: z.number().int(),
  scheduleVersion: z.number().int(),
  status: z.string(),
  startedAt: z.iso.datetime().nullable(),
  serverTime: z.iso.datetime(),
  policy: z.object({
    graceMinutes: z.number().int().min(0).max(1440),
    source: z.enum(["DELEGATED_DEFAULT", "APPROVED_BRANCH_POLICY"]),
    policyVersionId: z.uuid().nullable(),
  }),
  checkAt: z.iso.datetime(),
  checkAttendance: z.boolean(),
  workReviewRequired: z.boolean(),
  current: attendanceEventSchema.nullable(),
  events: z.array(attendanceEventSchema).max(30),
  receipt: attendanceEventSchema.nullable(),
});
export const attendanceReceiptSchema = z.object({
  event: attendanceEventSchema,
  performedByUserId: z.uuid(),
  attendance: attendanceSnapshotSchema,
});
export const parseAttendance = (value: unknown) => attendanceSnapshotSchema.parse(value);
export const attendanceLabels: Record<AttendanceEvent["kind"], string> = {
  ARRIVED: "Arrival recorded",
  WAITING: "Waiting for an available turn",
  LEFT: "Left the workshop",
  ABSENCE_CONFIRMED: "Staff verified a missed appointment",
};
