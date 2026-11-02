-- Expand reviewer attribution while preserving every existing verification rule.
-- Add the replacement before retiring the older, staff-only check.
ALTER TABLE "VehicleDocument"
  ADD CONSTRAINT "aat_vehicle_document_review_user_actor_valid"
  CHECK (
    ("verificationStatus" = 'PENDING' AND "verifiedAt" IS NULL)
    OR (
      "verificationStatus" = 'VERIFIED' AND "verifiedAt" IS NOT NULL
      AND ("reviewedByStaffId" IS NOT NULL OR "reviewedByUserId" IS NOT NULL)
    )
    OR (
      "verificationStatus" = 'REJECTED' AND "rejectionReason" IS NOT NULL
      AND ("reviewedByStaffId" IS NOT NULL OR "reviewedByUserId" IS NOT NULL)
    )
  );
ALTER TABLE "VehicleDocument" DROP CONSTRAINT "aat_vehicle_document_review_valid";
ALTER TABLE "VehicleDocument" RENAME CONSTRAINT "aat_vehicle_document_review_user_actor_valid" TO "aat_vehicle_document_review_valid";
