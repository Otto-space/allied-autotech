import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import { serviceOperationConflict } from "./service-operations.errors.js";

export const attendanceKinds = [
  "ARRIVED",
  "WAITING",
  "LEFT",
  "ABSENCE_CONFIRMED",
] as const;
export const bookingAttendanceBodySchema = z
  .strictObject({
    operationId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    kind: z.enum(attendanceKinds),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .refine(
        // Reject control characters in customer-visible factual notes.
        // eslint-disable-next-line no-control-regex
        (v) => !/[\u0000-\u001f\u007f]/.test(v),
        "Use a short, factual paragraph",
      )
      .optional(),
  })
  .refine((v) => v.kind === "ARRIVED" || !!v.reason, {
    path: ["reason"],
    message: "Record a factual reason for this update",
  });
export const bookingAttendanceQuerySchema = z.strictObject({
  receiptId: z.uuid().optional(),
});
export const bookingAttendanceEventSchema = z.object({
  id: z.uuid(),
  kind: z.enum(attendanceKinds),
  reason: z.string(),
  createdAt: z.iso.datetime(),
  bookingVersion: z.number().int(),
  scheduleVersion: z.number().int(),
  graceMinutes: z.number().int().nullable(),
  graceSource: z.enum(["DELEGATED_DEFAULT", "APPROVED_BRANCH_POLICY"]).nullable(),
});
export const bookingAttendanceSnapshotSchema = z.object({
  bookingId: z.uuid(),
  bookingVersion: z.number().int(),
  scheduleVersion: z.number().int(),
  status: z.string(),
  startedAt: z.iso.datetime().nullable(),
  serverTime: z.iso.datetime(),
  policy: z.object({
    graceMinutes: z.number().int(),
    source: z.enum(["DELEGATED_DEFAULT", "APPROVED_BRANCH_POLICY"]),
    policyVersionId: z.uuid().nullable(),
  }),
  checkAt: z.iso.datetime(),
  checkAttendance: z.boolean(),
  workReviewRequired: z.boolean(),
  current: bookingAttendanceEventSchema.nullable(),
  events: z.array(bookingAttendanceEventSchema).max(30),
  receipt: bookingAttendanceEventSchema.nullable(),
});
export const bookingAttendanceReceiptSchema = z.object({
  event: bookingAttendanceEventSchema,
  performedByUserId: z.uuid(),
  attendance: bookingAttendanceSnapshotSchema,
});
export type BookingAttendanceInput = z.infer<typeof bookingAttendanceBodySchema>;
export type AttendanceBooking = {
  id: string;
  branchId: string | null;
  scheduledAt: Date;
  status: string;
  startedAt: Date | null;
  scheduleVersion: number;
  version: number;
  workOrder?: { status: string } | null;
};
export const attendanceEventSelect = {
  id: true,
  kind: true,
  reason: true,
  createdAt: true,
  bookingVersion: true,
  scheduleVersion: true,
  graceMinutes: true,
  graceSource: true,
} satisfies Prisma.BookingAttendanceEventSelect;

export async function attendancePolicy(
  tx: Prisma.TransactionClient,
  branchId: string | null,
  now: Date,
) {
  const policy = branchId
    ? await tx.businessPolicyVersion.findFirst({
        where: {
          key: `booking-capacity:${branchId}`,
          approvalStatus: "APPROVED",
          effectiveAt: { lte: now },
        },
        orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
        select: { id: true, settings: true },
      })
    : null;
  const settings = z
    .object({ noShowGraceMinutes: z.number().int().min(0).max(1440).optional() })
    .safeParse(policy?.settings);
  if (
    policy &&
    policy.settings &&
    typeof policy.settings === "object" &&
    !Array.isArray(policy.settings) &&
    Object.hasOwn(policy.settings, "noShowGraceMinutes") &&
    !settings.success
  )
    throw serviceOperationConflict(
      "Review the invalid approved attendance grace setting before marking an appointment missed",
    );
  const configured = settings.success ? settings.data.noShowGraceMinutes : undefined;
  return {
    graceMinutes: configured ?? 15,
    source:
      configured === undefined
        ? ("DELEGATED_DEFAULT" as const)
        : ("APPROVED_BRANCH_POLICY" as const),
    policyVersionId: configured === undefined ? null : policy!.id,
  };
}

export function attendanceWorkReviewRequired(booking: AttendanceBooking) {
  return (
    !!booking.workOrder &&
    ["IN_PROGRESS", "AWAITING_PARTS", "QUALITY_CHECK", "COMPLETED"].includes(
      booking.workOrder.status,
    )
  );
}

export function attendanceCheckAt(scheduledAt: Date, graceMinutes: number) {
  return new Date(scheduledAt.getTime() + graceMinutes * 60_000);
}
export function assertAttendanceAction(
  booking: AttendanceBooking,
  kind: BookingAttendanceInput["kind"],
  previous: string | null,
  everArrived: boolean,
  graceMinutes: number,
  now: Date,
) {
  if (booking.status !== "CONFIRMED" || booking.startedAt !== null)
    throw serviceOperationConflict(
      "Attendance updates require an unstarted confirmed appointment",
    );
  if (kind === "ABSENCE_CONFIRMED") {
    if (attendanceWorkReviewRequired(booking))
      throw serviceOperationConflict(
        "Review the existing work order before marking this appointment missed",
      );
    if (everArrived)
      throw serviceOperationConflict(
        "An arrival is recorded. Review the visit instead of marking it missed",
      );
    if (now < attendanceCheckAt(booking.scheduledAt, graceMinutes))
      throw serviceOperationConflict("The attendance-check time has not been reached");
  } else if (kind === "ARRIVED") {
    if (previous === "ARRIVED" || previous === "WAITING")
      throw serviceOperationConflict("Arrival is already recorded for this visit");
  } else if (previous !== "ARRIVED" && previous !== "WAITING") {
    throw serviceOperationConflict(
      "Record the customer's arrival before waiting or leaving",
    );
  }
}

export function attendanceDigest(
  actorId: string,
  bookingId: string,
  input: BookingAttendanceInput,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        actorId,
        bookingId,
        input.expectedVersion,
        input.kind,
        input.reason ?? "Arrival recorded by the workshop",
      ]),
    )
    .digest("hex");
}

export async function attendanceSnapshot(
  tx: Prisma.TransactionClient,
  booking: AttendanceBooking,
  now = new Date(),
) {
  const policy = await attendancePolicy(tx, booking.branchId, now);
  const events = await tx.bookingAttendanceEvent.findMany({
    where: { bookingId: booking.id },
    select: attendanceEventSelect,
    orderBy: { bookingVersion: "desc" },
    take: 30,
  });
  const current =
    events.find((e) => e.scheduleVersion === booking.scheduleVersion) ?? null;
  const arrived = await tx.bookingAttendanceEvent.findFirst({
    where: {
      bookingId: booking.id,
      scheduleVersion: booking.scheduleVersion,
      kind: { in: ["ARRIVED", "WAITING", "LEFT"] },
    },
    select: { id: true },
  });
  const checkAt = attendanceCheckAt(booking.scheduledAt, policy.graceMinutes);
  return {
    workReviewRequired: attendanceWorkReviewRequired(booking),
    status: booking.status,
    startedAt: booking.startedAt?.toISOString() ?? null,
    receipt: null,
    bookingId: booking.id,
    bookingVersion: booking.version,
    scheduleVersion: booking.scheduleVersion,
    serverTime: now.toISOString(),
    policy,
    checkAt: checkAt.toISOString(),
    checkAttendance:
      booking.status === "CONFIRMED" &&
      !booking.startedAt &&
      !arrived &&
      !attendanceWorkReviewRequired(booking) &&
      now >= checkAt,
    current,
    events,
  };
}
