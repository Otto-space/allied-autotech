-- Counters identify reviewed defaults; existing unassessed offers are not backfilled.
ALTER TABLE "Service" ADD COLUMN "timingVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Service" ADD CONSTRAINT "Service_timingVersion_check" CHECK ("timingVersion" >= 0);
ALTER TABLE "BookingSlot" ADD COLUMN "durationMinutes" INTEGER, ADD COLUMN "preparationMinutes" INTEGER, ADD COLUMN "cleanupMinutes" INTEGER, ADD COLUMN "serviceTimingVersion" INTEGER;
ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_timing_check" CHECK (
 ("durationMinutes" IS NULL AND "preparationMinutes" IS NULL AND "cleanupMinutes" IS NULL AND "serviceTimingVersion" IS NULL)
 OR ("durationMinutes" IS NOT NULL AND "preparationMinutes" IS NOT NULL AND "cleanupMinutes" IS NOT NULL AND "serviceTimingVersion" IS NOT NULL
 AND "durationMinutes" BETWEEN 15 AND 1440 AND "preparationMinutes" BETWEEN 0 AND 1440 AND "cleanupMinutes" BETWEEN 0 AND 1440 AND "serviceTimingVersion" >= 0
 AND "endsAt" = "startsAt" + make_interval(mins => "durationMinutes"))
);
-- Extend the allowed provenance without changing any historical snapshot.
ALTER TABLE "BookingTimingSnapshot" DROP CONSTRAINT "BookingTimingSnapshot_values_check";
ALTER TABLE "BookingTimingSnapshot" ADD CONSTRAINT "BookingTimingSnapshot_values_check" CHECK ("scheduleVersion">=0 AND ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 15 AND 1440) AND ("preparationMinutes" IS NULL OR "preparationMinutes" BETWEEN 0 AND 1440) AND ("cleanupMinutes" IS NULL OR "cleanupMinutes" BETWEEN 0 AND 1440) AND length(btrim("reason"))>0 AND "source" IN ('SERVICE_DEFAULT','APPOINTMENT_OVERRIDE','LEGACY_CAPTURE','RESCHEDULE_CARRY_FORWARD'));
