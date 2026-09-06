-- Phase 8 hardens financial evidence and provider-event identity while allowing
-- only explicit lifecycle fields to change. All changes are forward-only.

CREATE OR REPLACE FUNCTION aat_protect_terminal_manual_review()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" IN ('APPROVED', 'REJECTED') AND ROW(
    NEW."paymentAttemptId", NEW."submittedByUserId", NEW."reviewedByUserId",
    NEW."status", NEW."bankReference", NEW."payerName", NEW."transferredAt",
    NEW."evidenceObjectKey", NEW."evidenceSha256", NEW."reviewedAt"
  ) IS DISTINCT FROM ROW(
    OLD."paymentAttemptId", OLD."submittedByUserId", OLD."reviewedByUserId",
    OLD."status", OLD."bankReference", OLD."payerName", OLD."transferredAt",
    OLD."evidenceObjectKey", OLD."evidenceSha256", OLD."reviewedAt"
  ) THEN
    RAISE EXCEPTION 'Reviewed manual payment evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ManualPaymentReview_protect_terminal" ON "ManualPaymentReview";
CREATE TRIGGER "ManualPaymentReview_protect_terminal"
BEFORE UPDATE ON "ManualPaymentReview"
FOR EACH ROW EXECUTE FUNCTION aat_protect_terminal_manual_review();

CREATE OR REPLACE FUNCTION aat_protect_approved_refund_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" <> 'REQUESTED' AND ROW(
    NEW."paymentAttemptId", NEW."requestedByUserId", NEW."approvedByUserId",
    NEW."refundNumber", NEW."idempotencyKeyHash", NEW."amountKobo",
    NEW."currency", NEW."reason", NEW."approvedAt"
  ) IS DISTINCT FROM ROW(
    OLD."paymentAttemptId", OLD."requestedByUserId", OLD."approvedByUserId",
    OLD."refundNumber", OLD."idempotencyKeyHash", OLD."amountKobo",
    OLD."currency", OLD."reason", OLD."approvedAt"
  ) THEN
    RAISE EXCEPTION 'Approved refund identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Refund_protect_approved_identity" ON "Refund";
CREATE TRIGGER "Refund_protect_approved_identity"
BEFORE UPDATE ON "Refund"
FOR EACH ROW EXECUTE FUNCTION aat_protect_approved_refund_identity();

CREATE OR REPLACE FUNCTION aat_protect_webhook_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(
    NEW."provider", NEW."providerEventId", NEW."deduplicationKey",
    NEW."eventType", NEW."payloadSha256", NEW."signatureVerifiedAt", NEW."receivedAt"
  ) IS DISTINCT FROM ROW(
    OLD."provider", OLD."providerEventId", OLD."deduplicationKey",
    OLD."eventType", OLD."payloadSha256", OLD."signatureVerifiedAt", OLD."receivedAt"
  ) THEN
    RAISE EXCEPTION 'Verified webhook identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PaymentWebhookEvent_protect_identity" ON "PaymentWebhookEvent";
CREATE TRIGGER "PaymentWebhookEvent_protect_identity"
BEFORE UPDATE ON "PaymentWebhookEvent"
FOR EACH ROW EXECUTE FUNCTION aat_protect_webhook_identity();

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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PaymentDispute_protect_identity" ON "PaymentDispute";
CREATE TRIGGER "PaymentDispute_protect_identity"
BEFORE UPDATE ON "PaymentDispute"
FOR EACH ROW EXECUTE FUNCTION aat_protect_dispute_financial_identity();

CREATE INDEX IF NOT EXISTS "Refund_provider_work_idx"
  ON "Refund" ("status", "createdAt")
  WHERE "status" IN ('APPROVED', 'PENDING', 'PROCESSING', 'NEEDS_ATTENTION');

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_retry_claim_idx"
  ON "PaymentWebhookEvent" ("nextAttemptAt", "receivedAt")
  WHERE "status" IN ('RECEIVED', 'FAILED');
