-- A provider receipt may back only one successful attempt, even when a caller
-- bypasses the payment service. Existing contradictory financial history is
-- never deleted, merged or reassigned by this migration. Stop for review if it
-- exists, rather than selecting an owner of the receipt automatically.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PaymentAttempt"
    WHERE "provider" IN ('PAYSTACK', 'MONNIFY') AND "status" = 'SUCCESSFUL'
    GROUP BY "provider", "gatewayTransactionId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate successful provider transaction identities require financial review before this migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "PaymentAttempt_one_success_per_provider_receipt"
  ON "PaymentAttempt" ("provider", "gatewayTransactionId")
  WHERE "provider" IN ('PAYSTACK', 'MONNIFY') AND "status" = 'SUCCESSFUL';

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "aat_successful_provider_receipt_nonempty"
  CHECK (
    "provider" = 'MANUAL' OR "status" <> 'SUCCESSFUL'
    OR length(btrim("gatewayTransactionId")) > 0
  );

COMMIT;
