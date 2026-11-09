-- Additive remaining-work reviews. Existing allocation/timing/audit rows remain unchanged.
ALTER TABLE "BookingResourceAllocation"
 ADD COLUMN "workReviewedAt" TIMESTAMP(3),
 ADD COLUMN "workStartedAt" TIMESTAMP(3),
 ADD COLUMN "remainingMinutes" INTEGER,
 ADD COLUMN "cleanupMinutes" INTEGER,
 ADD COLUMN "expectedWorkEndsAt" TIMESTAMP(3),
 ADD CONSTRAINT "BookingResourceAllocation_work_review_check" CHECK (
  ("workReviewedAt" IS NULL AND "workStartedAt" IS NULL AND "remainingMinutes" IS NULL AND "cleanupMinutes" IS NULL AND "expectedWorkEndsAt" IS NULL)
  OR ("workReviewedAt" IS NOT NULL AND "workStartedAt" IS NOT NULL AND "remainingMinutes" IS NOT NULL AND "cleanupMinutes" IS NOT NULL AND "expectedWorkEndsAt" IS NOT NULL
   AND "workReviewedAt">="workStartedAt" AND "remainingMinutes" BETWEEN 1 AND 1440 AND "cleanupMinutes" BETWEEN 0 AND 1440
   AND "expectedWorkEndsAt"="workReviewedAt"+make_interval(mins=>"remainingMinutes")
   AND "startsAt"="workReviewedAt" AND "endsAt"="expectedWorkEndsAt"+make_interval(mins=>"cleanupMinutes")));

-- Preserve all identity/policy/unit and append-only guards. Operational reviews
-- carry remaining work independently of an unknown original service estimate.
CREATE OR REPLACE FUNCTION aat_validate_booking_resource_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
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
  OR (NEW."workReviewedAt" IS NULL AND (
   t."durationMinutes" IS NULL OR t."preparationMinutes" IS NULL OR t."cleanupMinutes" IS NULL
   OR NEW."startsAt">b."scheduledAt"-make_interval(mins=>t."preparationMinutes")
   OR NEW."endsAt"<b."scheduledAt"+make_interval(mins=>t."durationMinutes"+t."cleanupMinutes")))
  OR (NEW."workReviewedAt" IS NOT NULL AND (
   b."startedAt" IS NULL OR NEW."workStartedAt" IS DISTINCT FROM b."startedAt"
   OR NEW."workReviewedAt"<b."startedAt"))
  OR p."key"<>'booking-resources:'||b."branchId"::text OR p."approvalStatus"<>'APPROVED' OR p."effectiveAt">CURRENT_TIMESTAMP
 THEN RAISE EXCEPTION 'Resource allocation must match the current booking, saved timing and approved branch resource policy'; END IF;
 IF cardinality(NEW."resourceIds")<>(SELECT count(DISTINCT id) FROM unnest(NEW."resourceIds") id)
  OR EXISTS (SELECT 1 FROM unnest(NEW."resourceIds") id WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p."settings"->'resources') r WHERE (r->>'id')::uuid=id AND r->>'status'='AVAILABLE'))
 THEN RAISE EXCEPTION 'Resource allocation must identify distinct available units from the reviewed policy'; END IF;
 RETURN NEW;
END; $$;
