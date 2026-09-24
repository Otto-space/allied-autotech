ALTER TABLE "Refund" ADD COLUMN "reconciliationFailures" INTEGER NOT NULL DEFAULT 0 CHECK ("reconciliationFailures" >= 0),
 ADD COLUMN "dueAt" TIMESTAMP(3), ADD COLUMN "clockPolicySnapshot" JSONB,
 ADD COLUMN "clockStatus" VARCHAR(80) NOT NULL DEFAULT 'ANCHOR_AND_BANK_CALENDAR_PENDING';
CREATE OR REPLACE FUNCTION aat_guard_system_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND ROW(NEW."authorizationKind",NEW."policyVersionId",NEW."policySnapshot") IS DISTINCT FROM ROW(OLD."authorizationKind",OLD."policyVersionId",OLD."policySnapshot") THEN
  RAISE EXCEPTION 'Refund authorization provenance is immutable';
 END IF;
 IF NEW."authorizationKind" = 'SYSTEM_LATE_ORDER' AND (
  NOT EXISTS (SELECT 1 FROM "BusinessPolicyVersion" v WHERE v."id" = NEW."policyVersionId" AND v."key" = 'order-payment' AND v."approvalStatus" = 'APPROVED' AND v."settings"->>'lateCaptureAction' = 'PROVIDER_REVERSAL')
  OR NOT EXISTS (SELECT 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id" = a."paymentId" JOIN "Order" o ON o."id" = p."orderId" WHERE a."id" = NEW."paymentAttemptId" AND a."verificationStatus" = 'VERIFIED' AND a."status" = 'SUCCESSFUL' AND a."provider" = 'PAYSTACK' AND o."paidAt" IS NULL AND o."paymentDueAt" <= CURRENT_TIMESTAMP)) THEN
  RAISE EXCEPTION 'System reversal requires an approved policy and verified late Paystack capture without fulfillment';
 END IF;
 IF NEW."status" = 'SUCCEEDED' AND EXISTS (SELECT 1 FROM "PaymentAttempt" WHERE "id" = NEW."paymentAttemptId" AND "provider" = 'MANUAL') AND (NEW."checkedByUserId" IS NULL OR NEW."evidenceObjectKey" IS NULL OR NEW."bankReference" IS NULL) THEN
  RAISE EXCEPTION 'Manual refund requires independent evidence check';
 END IF;
 IF TG_OP = 'UPDATE' AND OLD."dueAt" IS NOT NULL AND ROW(NEW."dueAt", NEW."clockPolicySnapshot") IS DISTINCT FROM ROW(OLD."dueAt", OLD."clockPolicySnapshot") THEN RAISE EXCEPTION 'Refund deadline snapshot is immutable'; END IF;
 RETURN NEW;
END; $$;
