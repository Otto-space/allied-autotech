ALTER TABLE "Order" ADD COLUMN "fulfillmentEvidenceAt" TIMESTAMP(3), ADD COLUMN "fulfillmentEvidenceReference" VARCHAR(300);
ALTER TABLE "VehicleTransaction" ADD COLUMN "paidHoldStartsAt" TIMESTAMP(3), ADD COLUMN "paidHoldExpiresAt" TIMESTAMP(3);
ALTER TABLE "PaymentDispute" ADD COLUMN "primaryUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
 ADD COLUMN "backupUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT, ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
 ADD COLUMN "acknowledgedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT, ADD COLUMN "acknowledgementDueAt" TIMESTAMP(3), ADD COLUMN "escalatedAt" TIMESTAMP(3), ADD COLUMN "evidenceChecklist" JSONB, ADD COLUMN "providerSubmissionReference" VARCHAR(200),
 ADD CONSTRAINT "aat_dispute_distinct_assignees" CHECK ("primaryUserId" IS NULL OR "backupUserId" IS NULL OR "primaryUserId" <> "backupUserId");
CREATE TABLE "OrderAftercareRequest" (
 "id" UUID PRIMARY KEY, "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT,
 "customerId" UUID NOT NULL REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT,
 "kind" VARCHAR(24) NOT NULL CHECK ("kind" IN ('CANCELLATION','RETURN')),
 "status" VARCHAR(32) NOT NULL DEFAULT 'REQUESTED' CHECK ("status" IN ('REQUESTED','RECEIVED','INSPECTED','APPROVED','REJECTED')),
 "reason" VARCHAR(2000) NOT NULL, "reviewReason" VARCHAR(1000) NOT NULL,
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "items" JSONB NOT NULL,
 "receivedAt" TIMESTAMP(3), "inspectedAt" TIMESTAMP(3), "inspectedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
 "inspectionNote" VARCHAR(2000), "goodCondition" BOOLEAN, "approvedFeeKobo" BIGINT CHECK ("approvedFeeKobo" >= 0),
 "reviewedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT, "reviewedAt" TIMESTAMP(3), "reviewNote" VARCHAR(2000),
 "policySnapshot" JSONB NOT NULL, "refundDueAt" TIMESTAMP(3), "refundClockStatus" VARCHAR(80) NOT NULL DEFAULT 'ANCHOR_AND_BANK_CALENDAR_PENDING',
 CONSTRAINT "aat_return_inspection_requires_receipt" CHECK ("inspectedAt" IS NULL OR "receivedAt" IS NOT NULL)
);
CREATE INDEX "OrderAftercareRequest_orderId_kind_requestedAt_idx" ON "OrderAftercareRequest"("orderId","kind","requestedAt");
CREATE INDEX "OrderAftercareRequest_status_requestedAt_idx" ON "OrderAftercareRequest"("status","requestedAt");
CREATE UNIQUE INDEX "Refund_bank_reference_unique" ON "Refund"("bankReference") WHERE "bankReference" IS NOT NULL;
CREATE UNIQUE INDEX "Refund_evidence_key_unique" ON "Refund"("evidenceObjectKey") WHERE "evidenceObjectKey" IS NOT NULL;
