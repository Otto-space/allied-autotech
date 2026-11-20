-- Forward-only: every successful manual capture needs its own actual approved
-- bank/cash review, including duplicates not selected as the original receipt.
ALTER FUNCTION aat_cancelled_supply_snapshot(UUID) RENAME TO aat_cancelled_supply_snapshot_v124;
CREATE FUNCTION aat_cancelled_supply_snapshot(parent_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId"
  WHERE p."orderId"=parent_id AND a."provider"='MANUAL' AND a."status"='SUCCESSFUL'
   AND NOT EXISTS(SELECT 1 FROM "ManualPaymentReview" m WHERE m."paymentAttemptId"=a."id" AND m."status"='APPROVED'
    AND m."reviewedByUserId" IS NOT NULL AND (m."submittedByUserId" IS NULL OR m."submittedByUserId"<>m."reviewedByUserId")
    AND m."reviewedAt">=a."paidAt" AND m."reviewedAt"<=clock_timestamp()))
  OR EXISTS(SELECT 1 FROM "PaymentAnomaly" n JOIN "PaymentDispute" d ON d."id"=n."disputeId"
   JOIN "PaymentAttempt" a ON a."id"=d."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId"
   WHERE p."orderId"=parent_id AND n."status" IN ('OPEN','INVESTIGATING'))
 THEN RAISE EXCEPTION 'Review every actual manual capture and linked financial discrepancy before cancelled-order clearance'; END IF;
 RETURN aat_cancelled_supply_snapshot_v124(parent_id);
END; $$;
