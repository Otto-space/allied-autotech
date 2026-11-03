CREATE TABLE "BookingResourceAllocation" (
 "id" UUID NOT NULL PRIMARY KEY,
 "bookingId" UUID NOT NULL REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "bookingVersion" INTEGER NOT NULL,
 "scheduleVersion" INTEGER NOT NULL,
 "branchId" UUID NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "serviceId" UUID NOT NULL REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "staffId" UUID NOT NULL REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "scheduledAt" TIMESTAMP(3) NOT NULL,
 "startsAt" TIMESTAMP(3) NOT NULL,
 "endsAt" TIMESTAMP(3) NOT NULL,
 "resourceIds" UUID[] NOT NULL,
 "timingSnapshotId" UUID NOT NULL REFERENCES "BookingTimingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "policyVersionId" UUID NOT NULL REFERENCES "BusinessPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "reason" VARCHAR(1000) NOT NULL,
 "createdByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BookingResourceAllocation_values_check" CHECK (
  "bookingVersion">=0 AND "scheduleVersion">=0 AND "startsAt"<"endsAt"
  AND cardinality("resourceIds")<=40 AND array_position("resourceIds",NULL) IS NULL AND length(btrim("reason"))>=10)
);
CREATE UNIQUE INDEX "BookingResourceAllocation_bookingId_bookingVersion_key" ON "BookingResourceAllocation"("bookingId","bookingVersion");
CREATE INDEX "BookingResourceAllocation_startsAt_endsAt_idx" ON "BookingResourceAllocation"("startsAt","endsAt");
CREATE INDEX "BookingResourceAllocation_resourceIds_idx" ON "BookingResourceAllocation" USING GIN ("resourceIds");
CREATE FUNCTION aat_booking_resource_allocation_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Booking resource allocation history is append-only'; END; $$;
CREATE TRIGGER "BookingResourceAllocation_immutable" BEFORE UPDATE OR DELETE ON "BookingResourceAllocation" FOR EACH ROW EXECUTE FUNCTION aat_booking_resource_allocation_immutable();
CREATE TRIGGER "BookingResourceAllocation_no_truncate" BEFORE TRUNCATE ON "BookingResourceAllocation" FOR EACH STATEMENT EXECUTE FUNCTION aat_booking_resource_allocation_immutable();
CREATE FUNCTION aat_validate_booking_resource_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b "Booking"%ROWTYPE; t "BookingTimingSnapshot"%ROWTYPE; p "BusinessPolicyVersion"%ROWTYPE;
BEGIN
 SELECT * INTO b FROM "Booking" WHERE "id"=NEW."bookingId" FOR SHARE;
 SELECT * INTO t FROM "BookingTimingSnapshot" WHERE "id"=NEW."timingSnapshotId" FOR SHARE;
 SELECT * INTO p FROM "BusinessPolicyVersion" WHERE "id"=NEW."policyVersionId" FOR SHARE;
 IF b."id" IS NULL OR t."id" IS NULL OR p."id" IS NULL
  OR b."version" IS DISTINCT FROM NEW."bookingVersion" OR b."scheduleVersion" IS DISTINCT FROM NEW."scheduleVersion"
  OR b."branchId" IS DISTINCT FROM NEW."branchId" OR b."serviceId" IS DISTINCT FROM NEW."serviceId"
  OR b."assignedStaffId" IS DISTINCT FROM NEW."staffId" OR b."scheduledAt" IS DISTINCT FROM NEW."scheduledAt"
  OR b."status" NOT IN ('CONFIRMED','IN_PROGRESS')
  OR t."bookingId"<>b."id" OR t."scheduleVersion"<>b."scheduleVersion" OR t."scheduledAt"<>b."scheduledAt" OR t."serviceId"<>b."serviceId"
  OR t."durationMinutes" IS NULL OR t."preparationMinutes" IS NULL OR t."cleanupMinutes" IS NULL
  OR NEW."startsAt">b."scheduledAt"-make_interval(mins=>t."preparationMinutes")
  OR NEW."endsAt"<b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes")
  OR p."key"<>'booking-resources:'||b."branchId"::text OR p."approvalStatus"<>'APPROVED' OR p."effectiveAt">CURRENT_TIMESTAMP
 THEN RAISE EXCEPTION 'Resource allocation must match the current booking, saved timing and approved branch resource policy'; END IF;
 IF cardinality(NEW."resourceIds")<>(SELECT count(DISTINCT id) FROM unnest(NEW."resourceIds") id)
  OR EXISTS (SELECT 1 FROM unnest(NEW."resourceIds") id WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p."settings"->'resources') r WHERE (r->>'id')::uuid=id AND r->>'status'='AVAILABLE'))
 THEN RAISE EXCEPTION 'Resource allocation must identify distinct available units from the reviewed policy'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "BookingResourceAllocation_validate" BEFORE INSERT ON "BookingResourceAllocation" FOR EACH ROW EXECUTE FUNCTION aat_validate_booking_resource_allocation();
