-- New staff-recorded physical attendance only. Customer RSVP and historical
-- no-show records are preserved, never backfilled as physical arrival evidence.
CREATE TABLE "BookingAttendanceEvent" (
 "id" UUID NOT NULL,
 "bookingId" UUID NOT NULL,
 "recordedByUserId" UUID NOT NULL,
 "bookingVersion" INTEGER NOT NULL,
 "scheduleVersion" INTEGER NOT NULL,
 "kind" VARCHAR(32) NOT NULL,
 "reason" VARCHAR(1000) NOT NULL,
 "operationDigest" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "graceMinutes" INTEGER,
 "graceSource" VARCHAR(40),
 "gracePolicyVersionId" UUID,
 CONSTRAINT "BookingAttendanceEvent_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "BookingAttendanceEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingAttendanceEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingAttendanceEvent_gracePolicyVersionId_fkey" FOREIGN KEY ("gracePolicyVersionId") REFERENCES "BusinessPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingAttendanceEvent_values_check" CHECK (
   "bookingVersion">0 AND "scheduleVersion">=0 AND length(btrim("reason"))>0
   AND "operationDigest" ~ '^[a-f0-9]{64}$'
   AND "kind" IN ('ARRIVED','WAITING','LEFT','ABSENCE_CONFIRMED')
   AND (("kind"='ABSENCE_CONFIRMED' AND "graceMinutes" IS NOT NULL AND "graceSource" IS NOT NULL AND "graceMinutes" BETWEEN 0 AND 1440
     AND (("graceSource"='DELEGATED_DEFAULT' AND "graceMinutes"=15 AND "gracePolicyVersionId" IS NULL)
       OR ("graceSource"='APPROVED_BRANCH_POLICY' AND "gracePolicyVersionId" IS NOT NULL)))
     OR ("kind"<>'ABSENCE_CONFIRMED' AND "graceMinutes" IS NULL AND "graceSource" IS NULL AND "gracePolicyVersionId" IS NULL)))
);
CREATE UNIQUE INDEX "BookingAttendanceEvent_bookingId_bookingVersion_key" ON "BookingAttendanceEvent"("bookingId","bookingVersion");
CREATE INDEX "BookingAttendanceEvent_schedule_history_idx" ON "BookingAttendanceEvent"("bookingId","scheduleVersion","bookingVersion");
CREATE FUNCTION aat_preserve_booking_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Physical attendance history is append-only'; END; $$;
CREATE TRIGGER "BookingAttendanceEvent_immutable" BEFORE UPDATE OR DELETE ON "BookingAttendanceEvent" FOR EACH ROW EXECUTE FUNCTION aat_preserve_booking_attendance();
CREATE TRIGGER "BookingAttendanceEvent_no_truncate" BEFORE TRUNCATE ON "BookingAttendanceEvent" FOR EACH STATEMENT EXECUTE FUNCTION aat_preserve_booking_attendance();
CREATE FUNCTION aat_validate_booking_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b "Booking"%ROWTYPE; previous_kind TEXT; p "BusinessPolicyVersion"%ROWTYPE;
BEGIN
 SELECT * INTO b FROM "Booking" WHERE "id"=NEW."bookingId" FOR UPDATE;
 IF b."id" IS NULL OR b."version"<>NEW."bookingVersion" OR b."scheduleVersion"<>NEW."scheduleVersion" OR b."startedAt" IS NOT NULL THEN
   RAISE EXCEPTION 'Attendance must match the current unstarted appointment version';
 END IF;
 SELECT "kind" INTO previous_kind FROM "BookingAttendanceEvent" WHERE "bookingId"=b."id" AND "scheduleVersion"=b."scheduleVersion" ORDER BY "bookingVersion" DESC LIMIT 1;
 IF NEW."kind"='ABSENCE_CONFIRMED' THEN
   IF b."status"<>'NO_SHOW' OR b."scheduledAt"+make_interval(mins=>NEW."graceMinutes")>CURRENT_TIMESTAMP
      OR EXISTS (SELECT 1 FROM "BookingAttendanceEvent" WHERE "bookingId"=b."id" AND "scheduleVersion"=b."scheduleVersion" AND "kind" IN ('ARRIVED','WAITING','LEFT')) THEN
     RAISE EXCEPTION 'A missed appointment requires a timely staff absence check and no recorded arrival';
   END IF;
   IF NEW."gracePolicyVersionId" IS NOT NULL THEN
     SELECT * INTO p FROM "BusinessPolicyVersion" WHERE "id"=NEW."gracePolicyVersionId";
     IF p."id" IS NULL OR p."key" IS DISTINCT FROM 'booking-capacity:'||b."branchId"::text OR p."approvalStatus"<>'APPROVED' OR p."effectiveAt">CURRENT_TIMESTAMP
       OR (p."settings"->>'noShowGraceMinutes')::integer IS DISTINCT FROM NEW."graceMinutes" THEN
       RAISE EXCEPTION 'Attendance grace must match its approved branch policy';
     END IF;
   END IF;
 ELSE
   IF b."status"<>'CONFIRMED' OR (NEW."kind"='ARRIVED' AND previous_kind IN ('ARRIVED','WAITING'))
      OR (NEW."kind" IN ('WAITING','LEFT') AND (previous_kind IS NULL OR previous_kind NOT IN ('ARRIVED','WAITING'))) THEN
     RAISE EXCEPTION 'Attendance must follow the recorded physical visit';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "BookingAttendanceEvent_validate" BEFORE INSERT ON "BookingAttendanceEvent" FOR EACH ROW EXECUTE FUNCTION aat_validate_booking_attendance();
-- Deferred until the matching, append-only staff verification is inserted in
-- the same transaction. Existing historical NO_SHOW rows are not rewritten.
CREATE FUNCTION aat_require_missed_attendance_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='NO_SHOW' AND OLD."status" IS DISTINCT FROM NEW."status" AND NOT EXISTS (
   SELECT 1 FROM "BookingAttendanceEvent" e WHERE e."bookingId"=NEW."id" AND e."bookingVersion"=NEW."version" AND e."scheduleVersion"=NEW."scheduleVersion" AND e."kind"='ABSENCE_CONFIRMED'
 ) THEN RAISE EXCEPTION 'Record a staff absence verification before marking an appointment missed'; END IF;
 RETURN NEW;
END; $$;
CREATE CONSTRAINT TRIGGER "Booking_missed_requires_attendance" AFTER UPDATE ON "Booking" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION aat_require_missed_attendance_evidence();
