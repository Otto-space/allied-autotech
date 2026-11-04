import { z } from "zod";
export const bookingTimingSnapshotSchema = z.object({
  scheduleVersion: z.number().int().nonnegative(),
  scheduledAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(1440).nullable(),
  preparationMinutes: z.number().int().min(0).max(1440).nullable(),
  cleanupMinutes: z.number().int().min(0).max(1440).nullable(),
  source: z.enum([
    "SERVICE_DEFAULT",
    "APPOINTMENT_OVERRIDE",
    "LEGACY_CAPTURE",
    "RESCHEDULE_CARRY_FORWARD",
  ]),
  reason: z.string().max(1000),
  createdAt: z.iso.datetime(),
});
export type TimingBooking = {
  startedAt?: string | null;
  id: string;
  version: number;
  branchId: string | null;
  scheduledAt: string | null;
  status: string;
  scheduleVersion?: number;
  service: null | { durationMinutes?: number | null };
  assignedStaff?: null | { id: string };
  timingSnapshots?: z.infer<typeof bookingTimingSnapshotSchema>[];
};
export const timingOverrideSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  durationMinutes: z.number().int().min(15).max(1440),
  preparationMinutes: z.number().int().min(0).max(1440),
  cleanupMinutes: z.number().int().min(0).max(1440),
  reason: z
    .string()
    .trim()
    .min(10)
    .max(1000)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v)),
  resourceReviewNote: z
    .string()
    .trim()
    .min(10)
    .max(2000)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v)),
});
export type TimingOverride = z.infer<typeof timingOverrideSchema>;
export function parseTimingReceipt(
  value: unknown,
  before: TimingBooking,
  owner: string,
  input: TimingOverride,
) {
  const data = z
    .object({
      id: z.uuid(),
      branchId: z.uuid().nullable(),
      version: z.number().int(),
      scheduleVersion: z.number().int(),
      scheduledAt: z.iso.datetime(),
      status: z.string(),
      performedByUserId: z.uuid(),
      timing: bookingTimingSnapshotSchema.optional(),
      timingSnapshots: z.array(bookingTimingSnapshotSchema).optional(),
    })
    .parse(value);
  const timing =
    data.timing ??
    data.timingSnapshots?.find((row) => row.scheduleVersion === data.scheduleVersion);
  if (
    before.scheduleVersion === undefined ||
    data.id !== before.id ||
    data.branchId !== before.branchId ||
    data.version !== before.version + 1 ||
    data.scheduleVersion !== before.scheduleVersion + 1 ||
    data.scheduledAt !== before.scheduledAt ||
    data.status !== before.status ||
    data.performedByUserId !== owner ||
    !timing ||
    timing.scheduleVersion !== data.scheduleVersion ||
    timing.scheduledAt !== data.scheduledAt ||
    timing.source !== "APPOINTMENT_OVERRIDE" ||
    timing.durationMinutes !== input.durationMinutes ||
    timing.preparationMinutes !== input.preparationMinutes ||
    timing.cleanupMinutes !== input.cleanupMinutes ||
    timing.reason !== input.reason
  )
    throw Error(
      "The appointment timing receipt could not be verified. Check the current booking before trying again.",
    );
  return data;
}
