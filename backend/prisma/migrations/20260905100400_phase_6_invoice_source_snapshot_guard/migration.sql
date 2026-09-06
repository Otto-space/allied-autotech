-- Enforce server-owned invoice customer, currency, and amount snapshots at insertion.
CREATE OR REPLACE FUNCTION aat_validate_invoice_source_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_customer UUID;
  expected_currency CHAR(3);
  expected_subtotal BIGINT;
  expected_tax BIGINT;
  expected_total BIGINT;
BEGIN
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "customerId", "currency", "totalKobo", 0, "totalKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_total
      FROM "Order" WHERE "id" = NEW."orderId";
  ELSIF NEW."bookingId" IS NOT NULL THEN
    SELECT b."customerId", q."currency", q."subtotalKobo", q."taxKobo", q."totalKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_total
      FROM "Booking" b
      JOIN "ServiceQuote" q ON q."bookingId" = b."id" AND q."status" = 'ACCEPTED'
      WHERE b."id" = NEW."bookingId";
  ELSIF NEW."vehicleTransactionId" IS NOT NULL THEN
    SELECT "customerId", "currency", "agreedPriceKobo", 0, "agreedPriceKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_total
      FROM "VehicleTransaction" WHERE "id" = NEW."vehicleTransactionId";
  END IF;

  IF expected_customer IS NULL
    OR NEW."customerId" IS DISTINCT FROM expected_customer
    OR NEW."currency" IS DISTINCT FROM expected_currency
    OR NEW."subtotalKobo" IS DISTINCT FROM expected_subtotal
    OR NEW."taxKobo" IS DISTINCT FROM expected_tax
    OR NEW."totalKobo" IS DISTINCT FROM expected_total
  THEN
    RAISE EXCEPTION 'Invoice source, customer, currency, and amount snapshot must match server truth';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Invoice_validate_source_snapshot" ON "Invoice";
CREATE TRIGGER "Invoice_validate_source_snapshot"
BEFORE INSERT OR UPDATE OF "customerId", "orderId", "bookingId", "vehicleTransactionId", "currency", "subtotalKobo", "taxKobo", "totalKobo"
ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION aat_validate_invoice_source_snapshot();
