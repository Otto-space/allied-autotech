ALTER TABLE "VehicleConditionReport"
  ADD CONSTRAINT "aat_condition_report_asset_pair"
  CHECK (
    ("reportObjectKey" IS NULL AND "reportSha256" IS NULL)
    OR
    ("reportObjectKey" IS NOT NULL AND "reportSha256" ~ '^[0-9a-f]{64}$')
  ) NOT VALID;

ALTER TABLE "VehicleHandover"
  ADD CONSTRAINT "aat_handover_signature_pair"
  CHECK (
    ("signedDocumentObjectKey" IS NULL AND "signedDocumentSha256" IS NULL)
    OR
    ("signedDocumentObjectKey" IS NOT NULL AND "signedDocumentSha256" ~ '^[0-9a-f]{64}$')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION "aat_protect_vehicle_transaction_commitment"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Payment" payment
    INNER JOIN "PaymentAttempt" attempt ON attempt."paymentId" = payment."id"
    WHERE payment."vehicleTransactionId" = OLD."id"
  ) AND
     (NEW."vehicleListingId", NEW."customerId", NEW."customerName", NEW."customerPhone", NEW."customerEmail", NEW."askingPriceKobo", NEW."agreedPriceKobo", NEW."currency")
       IS DISTINCT FROM
     (OLD."vehicleListingId", OLD."customerId", OLD."customerName", OLD."customerPhone", OLD."customerEmail", OLD."askingPriceKobo", OLD."agreedPriceKobo", OLD."currency") THEN
    RAISE EXCEPTION 'vehicle buyer and price fields are immutable after payment activity' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
