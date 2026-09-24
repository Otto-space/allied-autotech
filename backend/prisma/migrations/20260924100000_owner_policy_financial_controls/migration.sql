CREATE TABLE "BusinessPolicyVersion" (
 "id" UUID PRIMARY KEY, "key" VARCHAR(100) NOT NULL, "version" INTEGER NOT NULL,
 "approvalStatus" VARCHAR(24) NOT NULL CHECK ("approvalStatus" IN ('APPROVED','DRAFT','PENDING')),
 "source" VARCHAR(500) NOT NULL, "sourceQuestion" VARCHAR(40) NOT NULL,
 "sourceSignatory" VARCHAR(160), "approvedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
 "effectiveAt" TIMESTAMP(3) NOT NULL, "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "settings" JSONB NOT NULL, "approvalEvidence" VARCHAR(1000)
);
CREATE UNIQUE INDEX "BusinessPolicyVersion_key_version_key" ON "BusinessPolicyVersion"("key","version");
CREATE INDEX "BusinessPolicyVersion_key_effectiveAt_idx" ON "BusinessPolicyVersion"("key","effectiveAt");
CREATE FUNCTION aat_immutable_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Policy versions are append-only'; END; $$;
CREATE TRIGGER "BusinessPolicyVersion_immutable" BEFORE UPDATE OR DELETE ON "BusinessPolicyVersion" FOR EACH ROW EXECUTE FUNCTION aat_immutable_policy();
CREATE TABLE "UserCapability" (
 "id" UUID PRIMARY KEY, "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "capability" VARCHAR(100) NOT NULL, "grantedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
 "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3)
);
CREATE INDEX "UserCapability_userId_capability_revokedAt_idx" ON "UserCapability"("userId","capability","revokedAt");
CREATE UNIQUE INDEX "UserCapability_active_unique" ON "UserCapability"("userId","capability") WHERE "revokedAt" IS NULL;
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000001','delivery',1,'PENDING','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q1','Osaro Chinwi','2026-09-22T00:00:00Z','{"collectionEnabled": true, "collectionAddress": "133 Stadium Road, beside Kilimanjaro, Port Harcourt, Rivers State, Nigeria", "zones": []}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000002','order-payment',1,'APPROVED','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q2','Osaro Chinwi','2026-09-22T00:00:00Z','{"windowMinutes": 30, "lateCaptureAction": "PROVIDER_REVERSAL", "lateRefundFeeKobo": "0"}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000003','vehicle',1,'DRAFT','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q3','Osaro Chinwi','2026-09-22T00:00:00Z','{"paymentWindowMinutes": 30, "depositBasisPoints": 7000, "paidHoldMinutes": 120, "buyerChangeFeeVehicleBasisPoints": 50, "paidHoldAnchor": null, "expiryDisposition": null}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000004','manual-refund',1,'APPROVED','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q4','Osaro Chinwi','2026-09-22T00:00:00Z','{"approverCapability": "REFUND_APPROVE", "transferCapability": "REFUND_TRANSFER", "checkerCapability": "REFUND_CHECK", "distinctActors": true}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000005','booking',1,'APPROVED','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q5-Q6','Osaro Chinwi','2026-09-22T00:00:00Z','{"confirmation": "STAFF_REVIEW", "cancellationFeeKobo": "0", "reminderMinutes": 60, "confirmationTargetMinutes": [10, 30], "openingDays": null, "dailyCapacity": null, "outOfHoursTarget": null}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000006','cancellation',1,'PENDING','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q6','Osaro Chinwi','2026-09-22T00:00:00Z','{"beforeConfirmationFeeKobo": "0", "lowerThresholdBasisPoints": 1000, "upperThresholdBasisPoints": 500, "thresholdKobo": "10000000", "basis": null, "equality": null, "returnDays": 14, "refundDays": 10, "refundClockWording": "10 business days after refund is received or confirmed", "refundAnchor": null, "bankCalendar": null}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000007','quotation',1,'APPROVED','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q7','Osaro Chinwi','2026-09-22T00:00:00Z','{"validityDays": 7, "shorterOverride": false}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000008','finance',1,'DRAFT','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q7-Q8','Osaro Chinwi','2026-09-22T00:00:00Z','{"vatBasisPoints": 750, "pricesIncludeVat": false, "rounding": "HALF_UP_MINOR_UNIT_TEST_ASSUMPTION", "discountTreatment": "BEFORE_VAT_TEST_ASSUMPTION", "deliveryTreatment": null, "invoiceIdentity": null, "paymentTerms": null}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000009','disputes',1,'PENDING','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q9','Osaro Chinwi','2026-09-22T00:00:00Z','{"primaryUserId": null, "backupUserId": null, "providerDeadlineAuthoritative": true, "sameWorkingDayAcknowledgement": true}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000010','reviews',1,'APPROVED','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q10','Osaro Chinwi','2026-09-22T00:00:00Z','{"verifiedAccount": true, "moderationRequired": true, "preserveOriginal": true, "transactionEligibility": true}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000011','complaints',1,'PENDING','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q11','Osaro Chinwi','2026-09-22T00:00:00Z','{"timezone": "Africa/Lagos", "days": [1, 2, 3, 4, 5, 6], "open": "08:00", "close": "18:00", "urgentBusinessMinutes": 60, "ordinaryBusinessDayDefinition": null, "holidays": null, "ownerUserId": null, "escalationUserId": null}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000012','marketing',1,'PENDING','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q12','Osaro Chinwi','2026-09-22T00:00:00Z','{"executionEnabled": false, "wording": null, "sender": null, "unsubscribe": null}'::jsonb);
INSERT INTO "BusinessPolicyVersion" ("id","key","version","approvalStatus","source","sourceQuestion","sourceSignatory","effectiveAt","settings") VALUES ('a2400000-0000-4000-8000-000000000013','retention',1,'PENDING','Owner checklist signed 22/09/26 and Q3/Q6 attachment','Q13','Osaro Chinwi','2026-09-22T00:00:00Z','{"destructiveExecutionEnabled": false, "recordTypeRules": [], "reviewRequired": true, "legalAndDisputeHolds": true}'::jsonb);
ALTER TABLE "Order" ADD COLUMN "policySnapshot" JSONB;
ALTER TABLE "Payment" ADD COLUMN "policySnapshot" JSONB;
ALTER TABLE "Invoice" ADD COLUMN "policySnapshot" JSONB;
ALTER TABLE "ServiceQuote" ADD COLUMN "policySnapshot" JSONB;
ALTER TABLE "VehicleTransaction" ADD COLUMN "policySnapshot" JSONB;
ALTER TABLE "Booking" ADD COLUMN "policySnapshot" JSONB;
ALTER TABLE "Refund"
 ALTER COLUMN "requestedByUserId" DROP NOT NULL,
 ADD COLUMN "authorizationKind" VARCHAR(40) NOT NULL DEFAULT 'HUMAN',
 ADD COLUMN "policyVersionId" UUID REFERENCES "BusinessPolicyVersion"("id") ON DELETE RESTRICT,
 ADD COLUMN "policySnapshot" JSONB,
 ADD COLUMN "submissionStartedAt" TIMESTAMP(3),
 ADD COLUMN "nextReconcileAt" TIMESTAMP(3),
 ADD COLUMN "transferredByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
 ADD COLUMN "transferRecordedAt" TIMESTAMP(3),
 ADD COLUMN "bankReference" VARCHAR(160),
 ADD COLUMN "bankTransferAt" TIMESTAMP(3),
 ADD COLUMN "beneficiaryEncrypted" JSONB,
 ADD COLUMN "evidenceObjectKey" VARCHAR(512),
 ADD COLUMN "evidenceSha256" CHAR(64),
 ADD COLUMN "checkedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
 ADD COLUMN "checkedAt" TIMESTAMP(3);
ALTER TABLE "Refund" DROP CONSTRAINT "aat_refund_status_timestamps";
ALTER TABLE "Refund" ADD CONSTRAINT "aat_refund_status_timestamps" CHECK (
 ("status" = 'REQUESTED' AND "approvedByUserId" IS NULL AND "approvedAt" IS NULL AND "authorizationKind" = 'HUMAN')
 OR ("status" IN ('APPROVED','PENDING','PROCESSING','NEEDS_ATTENTION','SUCCEEDED') AND "approvedAt" IS NOT NULL
 AND ("approvedByUserId" IS NOT NULL OR "authorizationKind" = 'SYSTEM_LATE_ORDER'))
 OR "status" IN ('FAILED','CANCELLED'));
ALTER TABLE "Refund" ADD CONSTRAINT "aat_refund_authorization" CHECK (
 ("authorizationKind" = 'HUMAN' AND "requestedByUserId" IS NOT NULL)
 OR ("authorizationKind" = 'SYSTEM_LATE_ORDER' AND "requestedByUserId" IS NULL AND "approvedByUserId" IS NULL AND "policyVersionId" IS NOT NULL AND "policySnapshot" IS NOT NULL));
ALTER TABLE "Refund" ADD CONSTRAINT "aat_refund_transfer_separation" CHECK (
 "transferredByUserId" IS NULL OR ("approvedByUserId" IS NOT NULL AND "transferredByUserId" <> "approvedByUserId" AND "transferredByUserId" <> "requestedByUserId"));
ALTER TABLE "Refund" ADD CONSTRAINT "aat_refund_check_separation" CHECK (
 "checkedByUserId" IS NULL OR ("transferredByUserId" IS NOT NULL AND "checkedByUserId" <> "transferredByUserId" AND "checkedByUserId" <> "approvedByUserId" AND "checkedByUserId" <> "requestedByUserId" AND "checkedAt" IS NOT NULL));
CREATE FUNCTION aat_guard_system_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND ROW(NEW."authorizationKind",NEW."policyVersionId",NEW."policySnapshot") IS DISTINCT FROM ROW(OLD."authorizationKind",OLD."policyVersionId",OLD."policySnapshot") THEN
  RAISE EXCEPTION 'Refund authorization provenance is immutable';
 END IF;
 IF NEW."authorizationKind" = 'SYSTEM_LATE_ORDER' THEN
  IF NOT EXISTS (SELECT 1 FROM "BusinessPolicyVersion" v WHERE v."id" = NEW."policyVersionId" AND v."key" = 'order-payment' AND v."approvalStatus" = 'APPROVED' AND v."settings"->>'lateCaptureAction' = 'PROVIDER_REVERSAL')
   OR NOT EXISTS (SELECT 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id" = a."paymentId" JOIN "Order" o ON o."id" = p."orderId" WHERE a."id" = NEW."paymentAttemptId" AND a."verificationStatus" = 'VERIFIED' AND a."status" = 'SUCCESSFUL' AND a."provider" = 'PAYSTACK' AND (o."status" = 'CANCELLED' OR o."paymentDueAt" <= CURRENT_TIMESTAMP)) THEN
   RAISE EXCEPTION 'System reversal requires an approved late-order policy and verified late Paystack capture';
  END IF;
 END IF;
 IF NEW."transferredByUserId" IS NOT NULL AND NEW."status" = 'SUCCEEDED' AND NEW."checkedByUserId" IS NULL THEN RAISE EXCEPTION 'Manual refund requires independent evidence check'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Refund_owner_controls" BEFORE INSERT OR UPDATE ON "Refund" FOR EACH ROW EXECUTE FUNCTION aat_guard_system_refund();
