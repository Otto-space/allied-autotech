-- Append-only proof that an observed physical visit continued through an approved
-- same-day, same-branch replacement. No existing appointment/event is rewritten.
CREATE TABLE "BookingVisitContinuation" (
 "id" UUID PRIMARY KEY, "bookingId" UUID NOT NULL, "scheduleVersion" INTEGER NOT NULL,
 "previousScheduleVersion" INTEGER NOT NULL, "eventId" UUID NOT NULL,
 "allocationId" UUID NOT NULL, "requestId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BookingVisitContinuation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingVisitContinuation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BookingAttendanceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingVisitContinuation_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "BookingResourceAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingVisitContinuation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BookingRescheduleRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BookingVisitContinuation_versions_check" CHECK ("previousScheduleVersion">=0 AND "scheduleVersion"="previousScheduleVersion"+1)
);
CREATE UNIQUE INDEX "BookingVisitContinuation_bookingId_scheduleVersion_key" ON "BookingVisitContinuation"("bookingId","scheduleVersion");
CREATE UNIQUE INDEX "BookingVisitContinuation_requestId_key" ON "BookingVisitContinuation"("requestId");
CREATE TRIGGER "BookingVisitContinuation_immutable" BEFORE UPDATE OR DELETE ON "BookingVisitContinuation" FOR EACH ROW EXECUTE FUNCTION aat_preserve_booking_attendance();
CREATE TRIGGER "BookingVisitContinuation_no_truncate" BEFORE TRUNCATE ON "BookingVisitContinuation" FOR EACH STATEMENT EXECUTE FUNCTION aat_preserve_booking_attendance();
CREATE FUNCTION aat_current_visit_event(booking_id UUID, schedule_version INTEGER) RETURNS UUID LANGUAGE sql STABLE AS $$
 SELECT COALESCE(
 (SELECT e."id" FROM "BookingAttendanceEvent" e WHERE e."bookingId"=booking_id AND e."scheduleVersion"=schedule_version ORDER BY e."bookingVersion" DESC LIMIT 1),
 (SELECT c."eventId" FROM "BookingVisitContinuation" c WHERE c."bookingId"=booking_id AND c."scheduleVersion"=schedule_version))
$$;
CREATE FUNCTION aat_validate_visit_continuation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b "Booking"%ROWTYPE; r "BookingRescheduleRequest"%ROWTYPE; e "BookingAttendanceEvent"%ROWTYPE; a "BookingResourceAllocation"%ROWTYPE;
BEGIN
 SELECT * INTO b FROM "Booking" WHERE "id"=NEW."bookingId" FOR UPDATE;
 SELECT * INTO r FROM "BookingRescheduleRequest" WHERE "id"=NEW."requestId";
 SELECT * INTO e FROM "BookingAttendanceEvent" WHERE "id"=NEW."eventId";
 SELECT * INTO a FROM "BookingResourceAllocation" WHERE "id"=NEW."allocationId";
 IF b."id" IS NULL OR b."status"<>'CONFIRMED' OR b."startedAt" IS NOT NULL OR b."scheduleVersion"<>NEW."scheduleVersion"
 OR r."bookingId" IS DISTINCT FROM b."id" OR r."status"<>'APPROVED' OR r."source"<>'WORKSHOP_ALTERNATIVE'
 OR r."startsAt"<>b."scheduledAt" OR r."branchId" IS DISTINCT FROM b."branchId"
 OR (r."originalSchedule"->>'scheduleVersion')::integer IS DISTINCT FROM NEW."previousScheduleVersion"
 OR r."originalSchedule"->>'status'<>'CONFIRMED' OR r."originalSchedule"->>'branchId' IS DISTINCT FROM b."branchId"::text
 OR a."bookingId" IS DISTINCT FROM b."id" OR a."scheduleVersion"<>NEW."previousScheduleVersion" OR a."branchId" IS DISTINCT FROM b."branchId"
 OR a."scheduledAt" IS DISTINCT FROM (r."originalSchedule"->>'scheduledAt')::timestamptz AT TIME ZONE 'UTC'
 OR e."bookingId" IS DISTINCT FROM b."id" OR e."kind" NOT IN ('ARRIVED','WAITING')
 OR e."id" IS DISTINCT FROM aat_current_visit_event(b."id",NEW."previousScheduleVersion")
 OR (e."createdAt"+interval '1 hour')::date<>(b."scheduledAt"+interval '1 hour')::date
 OR (e."createdAt"+interval '1 hour')::date<>(timezone('UTC',CURRENT_TIMESTAMP)+interval '1 hour')::date
 THEN RAISE EXCEPTION 'A continued visit requires observed presence and an approved same-day same-branch replacement'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "BookingVisitContinuation_validate" BEFORE INSERT ON "BookingVisitContinuation" FOR EACH ROW EXECUTE FUNCTION aat_validate_visit_continuation();

CREATE OR REPLACE FUNCTION aat_validate_booking_attendance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b "Booking"%ROWTYPE; previous_kind TEXT; p "BusinessPolicyVersion"%ROWTYPE;
BEGIN
 SELECT * INTO b FROM "Booking" WHERE "id"=NEW."bookingId" FOR UPDATE;
 IF b."id" IS NULL OR b."version"<>NEW."bookingVersion" OR b."scheduleVersion"<>NEW."scheduleVersion" OR b."startedAt" IS NOT NULL THEN
   RAISE EXCEPTION 'Attendance must match the current unstarted appointment version';
 END IF;
 SELECT "kind" INTO previous_kind FROM "BookingAttendanceEvent" WHERE "id"=aat_current_visit_event(b."id",b."scheduleVersion");
 IF NEW."kind"='ABSENCE_CONFIRMED' THEN
   IF b."status"<>'NO_SHOW' OR b."scheduledAt"+make_interval(mins=>NEW."graceMinutes")>CURRENT_TIMESTAMP
      OR EXISTS (SELECT 1 FROM "BookingAttendanceEvent" WHERE "bookingId"=b."id" AND "scheduleVersion"=b."scheduleVersion" AND "kind" IN ('ARRIVED','WAITING','LEFT'))
      OR EXISTS (SELECT 1 FROM "BookingVisitContinuation" WHERE "bookingId"=b."id" AND "scheduleVersion"=b."scheduleVersion") THEN
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
