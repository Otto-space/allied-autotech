-- Add nullable unassessed buffers; do not invent timings or alter existing bookings.
ALTER TABLE "Service" ADD COLUMN "preparationMinutes" INTEGER, ADD COLUMN "cleanupMinutes" INTEGER;
ALTER TABLE "Service" ADD CONSTRAINT "Service_buffers_check" CHECK (("preparationMinutes" IS NULL OR "preparationMinutes" BETWEEN 0 AND 1440) AND ("cleanupMinutes" IS NULL OR "cleanupMinutes" BETWEEN 0 AND 1440));
CREATE TABLE "BookingTimingSnapshot" (
 "id" UUID NOT NULL, "serviceId" UUID NOT NULL, "bookingId" UUID NOT NULL, "scheduleVersion" INTEGER NOT NULL,
 "scheduledAt" TIMESTAMP(3) NOT NULL, "serviceVersion" INTEGER,
 "durationMinutes" INTEGER, "preparationMinutes" INTEGER, "cleanupMinutes" INTEGER,
 "source" VARCHAR(32) NOT NULL, "reason" VARCHAR(1000) NOT NULL,
 "createdByUserId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BookingTimingSnapshot_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookingTimingSnapshot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingTimingSnapshot_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingTimingSnapshot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingTimingSnapshot_values_check" CHECK ("scheduleVersion">=0 AND ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 15 AND 1440) AND ("preparationMinutes" IS NULL OR "preparationMinutes" BETWEEN 0 AND 1440) AND ("cleanupMinutes" IS NULL OR "cleanupMinutes" BETWEEN 0 AND 1440) AND length(btrim("reason"))>0 AND "source" IN ('SERVICE_DEFAULT','APPOINTMENT_OVERRIDE','LEGACY_CAPTURE'))
);
CREATE UNIQUE INDEX "BookingTimingSnapshot_bookingId_scheduleVersion_key" ON "BookingTimingSnapshot"("bookingId","scheduleVersion");
CREATE INDEX "BookingTimingSnapshot_scheduledAt_idx" ON "BookingTimingSnapshot"("scheduledAt");
CREATE FUNCTION preserve_booking_timing_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Appointment timing history is immutable'; END $$;
CREATE TRIGGER "BookingTimingSnapshot_preserve_history" BEFORE UPDATE OR DELETE ON "BookingTimingSnapshot" FOR EACH ROW EXECUTE FUNCTION preserve_booking_timing_snapshot();
