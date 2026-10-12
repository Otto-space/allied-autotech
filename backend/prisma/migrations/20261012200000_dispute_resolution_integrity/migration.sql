-- Preserve existing financial identity and the first committed resolution.
-- This replaces a guard only; historical dispute/ledger rows are not rewritten.
CREATE OR REPLACE FUNCTION aat_protect_dispute_financial_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(
    NEW."paymentAttemptId", NEW."provider", NEW."providerDisputeId",
    NEW."category", NEW."amountKobo", NEW."currency", NEW."openedAt"
  ) IS DISTINCT FROM ROW(
    OLD."paymentAttemptId", OLD."provider", OLD."providerDisputeId",
    OLD."category", OLD."amountKobo", OLD."currency", OLD."openedAt"
  ) THEN
    RAISE EXCEPTION 'Dispute financial identity is immutable';
  END IF;
  IF (OLD."resolvedAt" IS NOT NULL OR OLD."status" IN ('WON', 'LOST', 'ACCEPTED', 'EXPIRED'))
    AND ROW(NEW."status", NEW."resolvedAt") IS DISTINCT FROM ROW(OLD."status", OLD."resolvedAt")
  THEN
    RAISE EXCEPTION 'Resolved dispute outcome and time are immutable';
  END IF;
  RETURN NEW;
END;
$$;
