-- Permit the new, explicitly versioned 20% quotation deposit without rewriting
-- or reinterpreting historical 30% deposit snapshots or no-deposit requests.
-- Application activation remains independently gated.
ALTER TABLE "Booking"
  DROP CONSTRAINT "aat_booking_deposit_snapshot_complete";

ALTER TABLE "Booking"
  ADD CONSTRAINT "aat_booking_deposit_snapshot_complete" CHECK (
    ("bookingSlotId" IS NULL AND "depositPolicyVersion" IS DISTINCT FROM 'approved-quote-deposit-20-v1')
    OR (
      "depositPolicyVersion" = 'owner-booking-request-v2'
      AND "branchId" IS NOT NULL
      AND "assignedStaffId" IS NOT NULL
      AND "depositAmountKobo" IS NULL
      AND "paymentHoldExpiresAt" IS NULL
    )
    OR (
      "branchId" IS NOT NULL
      AND "assignedStaffId" IS NOT NULL
      AND "depositBaseKobo" > 0
      AND "depositBasisPoints" = 3000
      AND "depositAmountKobo" = ("depositBaseKobo" * "depositBasisPoints" + 5000) / 10000
      AND "depositPolicyVersion" IS NOT NULL
      AND "depositPolicyVersion" <> 'approved-quote-deposit-20-v1'
      AND "depositTermsAcceptedAt" IS NOT NULL
      AND "paymentHoldExpiresAt" > "createdAt"
    )
    OR (
      "depositPolicyVersion" = 'approved-quote-deposit-20-v1'
      AND "branchId" IS NOT NULL
      AND "assignedStaffId" IS NOT NULL
      AND "depositBaseKobo" > 0
      AND "depositBasisPoints" = 2000
      AND "depositAmountKobo" IS NOT NULL
      AND "depositAmountKobo" > 0
      AND "depositAmountKobo" = ("depositBaseKobo" * 2000 + 5000) / 10000
      AND "depositTermsAcceptedAt" IS NOT NULL
      AND "paymentHoldExpiresAt" IS NOT NULL
      AND "paymentHoldExpiresAt" > "createdAt"
    )
  );
