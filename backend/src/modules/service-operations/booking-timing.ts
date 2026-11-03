import type { Prisma } from "../../generated/prisma/client.js";
import { serviceOperationConflict } from "./service-operations.errors.js";
export type TimingValues = {
  durationMinutes: number | null;
  preparationMinutes: number | null;
  cleanupMinutes: number | null;
};
export function timingWindow(scheduledAt: Date, timing: TimingValues) {
  const values = [
    timing.durationMinutes,
    timing.preparationMinutes,
    timing.cleanupMinutes,
  ];
  if (
    !Number.isFinite(scheduledAt.getTime()) ||
    values.some((value) => value === null || !Number.isInteger(value)) ||
    timing.durationMinutes! < 15 ||
    timing.durationMinutes! > 1440 ||
    timing.preparationMinutes! < 0 ||
    timing.preparationMinutes! > 1440 ||
    timing.cleanupMinutes! < 0 ||
    timing.cleanupMinutes! > 1440
  )
    throw serviceOperationConflict(
      "Review the job estimate, preparation and cleanup time before scheduling. Unknown is not zero.",
    );
  return {
    startsAt: new Date(scheduledAt.getTime() - timing.preparationMinutes! * 60000),
    jobEndsAt: new Date(scheduledAt.getTime() + timing.durationMinutes! * 60000),
    endsAt: new Date(
      scheduledAt.getTime() + (timing.durationMinutes! + timing.cleanupMinutes!) * 60000,
    ),
  };
}
export async function captureBookingTiming(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    scheduleVersion: number;
    scheduledAt: Date;
    serviceId: string | null;
  },
  actorId: string,
  preserveUnassessed = false,
  unassessedSource: "LEGACY_CAPTURE" | "SERVICE_DEFAULT" = "LEGACY_CAPTURE",
) {
  const where = {
    bookingId_scheduleVersion: {
      bookingId: booking.id,
      scheduleVersion: booking.scheduleVersion,
    },
  };
  const saved = await tx.bookingTimingSnapshot.findUnique({ where });
  if (saved) {
    if (
      saved.scheduledAt.getTime() !== booking.scheduledAt.getTime() ||
      saved.serviceId !== booking.serviceId
    )
      throw serviceOperationConflict(
        "The saved appointment timing does not match the current schedule",
      );
    if (!preserveUnassessed) timingWindow(booking.scheduledAt, saved);
    return saved;
  }
  if (!booking.serviceId)
    throw serviceOperationConflict(
      "Assess the concern and choose a service before confirming its timing",
    );
  await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${booking.serviceId}::uuid FOR SHARE`;
  const service = await tx.service.findUnique({
    where: { id: booking.serviceId },
    select: {
      durationMinutes: true,
      preparationMinutes: true,
      cleanupMinutes: true,
      version: true,
      isActive: true,
    },
  });
  if (!service?.isActive) throw serviceOperationConflict("The service is unavailable");
  if (!preserveUnassessed) timingWindow(booking.scheduledAt, service);
  return tx.bookingTimingSnapshot.create({
    data: {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      scheduleVersion: booking.scheduleVersion,
      scheduledAt: booking.scheduledAt,
      serviceVersion: service.version,
      durationMinutes: service.durationMinutes,
      preparationMinutes: service.preparationMinutes,
      cleanupMinutes: service.cleanupMinutes,
      source: preserveUnassessed ? unassessedSource : "SERVICE_DEFAULT",
      reason:
        preserveUnassessed && unassessedSource === "LEGACY_CAPTURE"
          ? "Captured current estimate before a reasoned appointment override; not reconstructed historical timing"
          : "Recorded current service estimate, including any unassessed values; this does not confirm the appointment",
      createdByUserId: actorId,
    },
  });
}
/** Capture the current legacy estimate before editing defaults; this does not claim
 * to reconstruct an original historical estimate or turn unknown buffers into zero. */
export async function preserveExistingBookingTiming(
  tx: Prisma.TransactionClient,
  serviceId: string,
  actorId: string,
) {
  // Booking operations lock their booking before its service. Take existing
  // bookings first in stable order so a legacy snapshot insert cannot deadlock
  // against a booking operation waiting for the service lock.
  await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "serviceId"=${serviceId}::uuid ORDER BY "id" FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${serviceId}::uuid FOR UPDATE`;
  const service = await tx.service.findUniqueOrThrow({
    where: { id: serviceId },
    select: {
      durationMinutes: true,
      preparationMinutes: true,
      cleanupMinutes: true,
      version: true,
    },
  });
  await tx.$executeRaw`
    INSERT INTO "BookingTimingSnapshot" ("id","serviceId","bookingId","scheduleVersion","scheduledAt","serviceVersion","durationMinutes","preparationMinutes","cleanupMinutes","source","reason","createdByUserId")
    SELECT gen_random_uuid(), ${serviceId}::uuid, b."id", b."scheduleVersion", b."scheduledAt", ${service.version}, ${service.durationMinutes}::integer, ${service.preparationMinutes}::integer, ${service.cleanupMinutes}::integer,
      'LEGACY_CAPTURE', 'Captured current estimate before editing service timing; not reconstructed historical timing', ${actorId}::uuid
    FROM "Booking" b WHERE b."serviceId"=${serviceId}::uuid
    ON CONFLICT ("bookingId","scheduleVersion") DO NOTHING
  `;
}

export function bookedJobMinutes(booking: {
  scheduleVersion: number;
  timingSnapshots: Array<{ scheduleVersion: number; durationMinutes: number | null }>;
  service: null | { durationMinutes: number | null };
}) {
  const saved = booking.timingSnapshots.find(
    (timing) => timing.scheduleVersion === booking.scheduleVersion,
  );
  return saved ? saved.durationMinutes : (booking.service?.durationMinutes ?? null);
}

export async function assignmentTimingWindow(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    serviceId: string | null;
    scheduleVersion: number;
    scheduledAt: Date;
    status: string;
  },
  actorId: string,
  classifiedServiceId?: string,
) {
  const saved = await tx.bookingTimingSnapshot.findUnique({
    where: {
      bookingId_scheduleVersion: {
        bookingId: booking.id,
        scheduleVersion: booking.scheduleVersion,
      },
    },
  });
  const serviceId = classifiedServiceId ?? booking.serviceId;
  if (!serviceId)
    throw serviceOperationConflict(
      "Choose the actual service before technician assignment",
    );
  if (
    saved &&
    (saved.serviceId !== serviceId ||
      saved.scheduledAt.getTime() !== booking.scheduledAt.getTime())
  )
    throw serviceOperationConflict(
      "The saved estimate needs an authorised appointment review",
    );
  await tx.$queryRaw`SELECT "id" FROM "Service" WHERE "id"=${serviceId}::uuid FOR SHARE`;
  const service = await tx.service.findUnique({
    where: { id: serviceId },
    select: {
      durationMinutes: true,
      preparationMinutes: true,
      cleanupMinutes: true,
      isActive: true,
    },
  });
  if (!service?.isActive) throw serviceOperationConflict("The service is unavailable");
  const timing = saved ?? service;
  if (
    timing.durationMinutes !== null &&
    timing.preparationMinutes !== null &&
    timing.cleanupMinutes !== null
  ) {
    if (!saved && !classifiedServiceId) await captureBookingTiming(tx, booking, actorId);
    return timingWindow(booking.scheduledAt, timing);
  }
  if (booking.status === "CONFIRMED")
    throw serviceOperationConflict(
      "Review the existing confirmed appointment's estimate before changing its technician",
    );
  // Unassessed pending work occupies this technician's day conservatively. This is
  // not a guessed job duration or a claim that the appointment is confirmed.
  const day = new Date(booking.scheduledAt.getTime() + 3600000)
    .toISOString()
    .slice(0, 10);
  const startsAt = new Date(`${day}T00:00:00+01:00`);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + 86400000),
    jobEndsAt: new Date(startsAt.getTime() + 86400000),
  };
}
export async function captureAssessedTimingIfMissing(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    serviceId: string | null;
    scheduleVersion: number;
    scheduledAt: Date;
  },
  actorId: string,
) {
  if (
    !booking.serviceId ||
    (await tx.bookingTimingSnapshot.findUnique({
      where: {
        bookingId_scheduleVersion: {
          bookingId: booking.id,
          scheduleVersion: booking.scheduleVersion,
        },
      },
      select: { id: true },
    }))
  )
    return;
  const service = await tx.service.findUnique({
    where: { id: booking.serviceId },
    select: { durationMinutes: true, preparationMinutes: true, cleanupMinutes: true },
  });
  if (
    service?.durationMinutes !== null &&
    service?.durationMinutes !== undefined &&
    service.preparationMinutes !== null &&
    service.cleanupMinutes !== null
  )
    await captureBookingTiming(tx, booking, actorId);
}

/** The reviewed original estimate follows an approved move; current defaults do not replace it. */
export async function carryBookingTiming(
  tx: Prisma.TransactionClient,
  original: {
    id: string;
    serviceId: string | null;
    scheduleVersion: number;
    scheduledAt: Date;
  },
  moved: { scheduleVersion: number; scheduledAt: Date },
  actorId: string,
) {
  const saved = await captureBookingTiming(tx, original, actorId);
  if (moved.scheduleVersion !== original.scheduleVersion + 1)
    throw serviceOperationConflict("The replacement schedule version is not current");
  return tx.bookingTimingSnapshot.create({
    data: {
      bookingId: original.id,
      serviceId: saved.serviceId,
      scheduleVersion: moved.scheduleVersion,
      scheduledAt: moved.scheduledAt,
      serviceVersion: saved.serviceVersion,
      durationMinutes: saved.durationMinutes,
      preparationMinutes: saved.preparationMinutes,
      cleanupMinutes: saved.cleanupMinutes,
      source: "RESCHEDULE_CARRY_FORWARD",
      reason:
        "Preserved the previously recorded estimate during an approved appointment move; see previous timing history for its assessment",
      createdByUserId: actorId,
    },
  });
}

/** Preserve the existing published-slot binding; a different published technician needs a reviewed replacement. */
export function assertPublishedSlotAssignment(
  booking: { bookingSlotId: string | null; assignedStaffId: string | null },
  targetStaffId: string,
) {
  if (booking.bookingSlotId !== null && booking.assignedStaffId !== targetStaffId)
    throw serviceOperationConflict(
      "This appointment is tied to a published slot. Use reschedule approval with a matching replacement slot to change its technician; the current appointment is unchanged.",
    );
}
