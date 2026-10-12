-- Preserve historical disputed amounts and ledger entries; new fields are unknown
-- for historical rows until a supported provider observation is applied.
ALTER TABLE "PaymentDispute"
  ADD COLUMN "providerStatus" VARCHAR(80),
  ADD COLUMN "providerResolution" VARCHAR(80),
  ADD COLUMN "providerReviewReason" VARCHAR(100),
  ADD COLUMN "providerUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "chargebackAmountKobo" BIGINT,
  ADD CONSTRAINT "PaymentDispute_chargeback_amount_check" CHECK (
    "chargebackAmountKobo" IS NULL OR
    ("chargebackAmountKobo" > 0 AND "chargebackAmountKobo" <= "amountKobo"
      AND "status" IN ('LOST','ACCEPTED') AND "resolvedAt" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION aat_protect_dispute_financial_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."paymentAttemptId",NEW."provider",NEW."providerDisputeId",NEW."category",NEW."amountKobo",NEW."currency",NEW."openedAt")
    IS DISTINCT FROM ROW(OLD."paymentAttemptId",OLD."provider",OLD."providerDisputeId",OLD."category",OLD."amountKobo",OLD."currency",OLD."openedAt")
  THEN RAISE EXCEPTION 'Dispute financial identity is immutable'; END IF;
  IF (OLD."resolvedAt" IS NOT NULL OR OLD."status" IN ('WON','LOST','ACCEPTED','EXPIRED'))
    AND ROW(NEW."status",NEW."resolvedAt",NEW."chargebackAmountKobo")
      IS DISTINCT FROM ROW(OLD."status",OLD."resolvedAt",OLD."chargebackAmountKobo")
  THEN RAISE EXCEPTION 'Resolved dispute outcome, time and chargeback amount are immutable'; END IF;
  RETURN NEW;
END;
$$;
