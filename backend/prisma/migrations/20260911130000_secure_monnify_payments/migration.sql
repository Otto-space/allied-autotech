-- Adds encrypted checkout-state storage and distinguishes cryptographic webhook
-- authentication from authoritative provider verification. No existing rows or
-- financial facts are rewritten.

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "encryptedCheckoutState" JSONB,
  ADD COLUMN "authorizationExpiresAt" TIMESTAMPTZ(3);

ALTER TABLE "PaymentWebhookEvent"
  ALTER COLUMN "signatureVerifiedAt" DROP NOT NULL,
  ADD COLUMN "providerVerifiedAt" TIMESTAMPTZ(3);

ALTER TABLE "PaymentAttempt"
  DROP CONSTRAINT "aat_payment_attempt_provider_fields_valid",
  ADD CONSTRAINT "aat_payment_attempt_provider_fields_valid"
  CHECK (
    ("provider" IN ('PAYSTACK', 'MONNIFY') AND "method" IS DISTINCT FROM 'CASH')
    OR
    ("provider" = 'MANUAL' AND "method" IN ('BANK_TRANSFER', 'POS', 'CASH'))
  ),
  ADD CONSTRAINT "aat_payment_attempt_online_success_reference_required"
  CHECK (
    "provider" = 'MANUAL'
    OR "status" <> 'SUCCESSFUL'
    OR ("providerReference" IS NOT NULL AND "gatewayTransactionId" IS NOT NULL)
  ),
  ADD CONSTRAINT "aat_payment_attempt_checkout_state_object"
  CHECK (
    "encryptedCheckoutState" IS NULL
    OR jsonb_typeof("encryptedCheckoutState") = 'object'
  ),
  ADD CONSTRAINT "aat_payment_attempt_checkout_expiry_pair"
  CHECK (("encryptedCheckoutState" IS NULL) = ("authorizationExpiresAt" IS NULL));

ALTER TABLE "PaymentWebhookEvent"
  ADD CONSTRAINT "aat_webhook_event_verification_required"
  CHECK (
    "status" NOT IN ('PROCESSING', 'PROCESSED')
    OR num_nonnulls("signatureVerifiedAt", "providerVerifiedAt") >= 1
  );

CREATE INDEX "PaymentAttempt_provider_status_initiatedAt_idx"
  ON "PaymentAttempt" ("provider", "status", "initiatedAt");

CREATE OR REPLACE FUNCTION aat_protect_webhook_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(
    NEW."provider", NEW."providerEventId", NEW."deduplicationKey",
    NEW."eventType", NEW."payloadSha256", NEW."signatureVerifiedAt",
    NEW."providerVerifiedAt", NEW."receivedAt"
  ) IS DISTINCT FROM ROW(
    OLD."provider", OLD."providerEventId", OLD."deduplicationKey",
    OLD."eventType", OLD."payloadSha256", OLD."signatureVerifiedAt",
    OLD."providerVerifiedAt", OLD."receivedAt"
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
