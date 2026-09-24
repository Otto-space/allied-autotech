ALTER TABLE "Booking" ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ADD COLUMN "attendanceConfirmedAt" TIMESTAMP(3), ADD COLUMN "resourceReviewNote" TEXT,
 ADD COLUMN "capacityPolicyVersionId" UUID REFERENCES "BusinessPolicyVersion"("id") ON DELETE RESTRICT;
UPDATE "Booking" SET "requestedAt" = "createdAt";
ALTER TABLE "Booking" DROP CONSTRAINT "aat_booking_deposit_snapshot_complete";
ALTER TABLE "Booking" ADD CONSTRAINT "aat_booking_deposit_snapshot_complete" CHECK (
 "bookingSlotId" IS NULL OR
 ("depositPolicyVersion" = 'owner-booking-request-v2' AND "branchId" IS NOT NULL AND "assignedStaffId" IS NOT NULL AND "depositAmountKobo" IS NULL AND "paymentHoldExpiresAt" IS NULL)
 OR ("branchId" IS NOT NULL AND "assignedStaffId" IS NOT NULL AND "depositBaseKobo" > 0 AND "depositBasisPoints" = 3000
 AND "depositAmountKobo" = ("depositBaseKobo" * "depositBasisPoints" + 5000) / 10000 AND "depositPolicyVersion" IS NOT NULL
 AND "depositTermsAcceptedAt" IS NOT NULL AND "paymentHoldExpiresAt" > "createdAt"));
