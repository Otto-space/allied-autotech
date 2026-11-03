-- Add pending requests without changing any existing appointment or history.
CREATE TYPE "BookingRescheduleStatus" AS ENUM ('PENDING','APPROVED','DECLINED','WITHDRAWN','SUPERSEDED');
CREATE TYPE "BookingRescheduleSource" AS ENUM ('CUSTOMER','WORKSHOP_ALTERNATIVE');
CREATE TABLE "BookingRescheduleRequest" (
 "id" UUID NOT NULL, "bookingId" UUID NOT NULL, "requestedByUserId" UUID NOT NULL,
 "decidedByUserId" UUID, "branchId" UUID NOT NULL, "slotId" UUID,
 "startsAt" TIMESTAMP(3) NOT NULL, "reason" VARCHAR(1000) NOT NULL,
 "source" "BookingRescheduleSource" NOT NULL, "originalSchedule" JSONB NOT NULL,
 "status" "BookingRescheduleStatus" NOT NULL DEFAULT 'PENDING',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "decidedAt" TIMESTAMP(3), "decisionReason" VARCHAR(500),
 CONSTRAINT "BookingRescheduleRequest_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookingRescheduleRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingRescheduleRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingRescheduleRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingRescheduleRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingRescheduleRequest_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "BookingSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingRescheduleRequest_reason_check" CHECK (length(btrim("reason")) > 0),
 CONSTRAINT "BookingRescheduleRequest_decision_check" CHECK (
   ("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedByUserId" IS NULL AND "decisionReason" IS NULL) OR
   ("status" <> 'PENDING' AND "decidedAt" IS NOT NULL AND "decidedByUserId" IS NOT NULL AND length(btrim("decisionReason")) > 0))
);
CREATE INDEX "BookingRescheduleRequest_bookingId_createdAt_idx" ON "BookingRescheduleRequest"("bookingId","createdAt");
CREATE INDEX "BookingRescheduleRequest_branchId_status_createdAt_idx" ON "BookingRescheduleRequest"("branchId","status","createdAt");
CREATE UNIQUE INDEX "BookingRescheduleRequest_one_pending" ON "BookingRescheduleRequest"("bookingId") WHERE "status"='PENDING';
CREATE FUNCTION preserve_booking_reschedule_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Booking reschedule history cannot be deleted'; END IF;
 IF OLD."status" <> 'PENDING' OR NEW."status" = 'PENDING' OR
   (to_jsonb(NEW) - ARRAY['status','decidedAt','decidedByUserId','decisionReason']) IS DISTINCT FROM
   (to_jsonb(OLD) - ARRAY['status','decidedAt','decidedByUserId','decisionReason']) THEN
   RAISE EXCEPTION 'Booking reschedule request details and terminal history are immutable';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "BookingRescheduleRequest_preserve_history" BEFORE UPDATE OR DELETE ON "BookingRescheduleRequest"
 FOR EACH ROW EXECUTE FUNCTION preserve_booking_reschedule_request();
