BEGIN;
SET LOCAL lock_timeout = '10s';
-- Expand purchase ownership without changing or deleting existing business rows.
-- Existing account ownership remains intact. Guest creation is not exposed yet.
ALTER TABLE "Order" ADD COLUMN "guestId" UUID;
ALTER TABLE "Order" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "PurchaseGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_exactly_one_buyer"
  CHECK (num_nonnulls("customerId", "guestId") = 1);
CREATE INDEX "Order_guestId_createdAt_idx" ON "Order"("guestId", "createdAt");
CREATE INDEX "Order_guest_directory_idx" ON "Order"("guestId", "id");

ALTER TABLE "Invoice" ADD COLUMN "guestId" UUID;
ALTER TABLE "Invoice" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "PurchaseGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_exactly_one_buyer"
  CHECK (num_nonnulls("customerId", "guestId") = 1);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_guest_parts_order_only"
  CHECK ("guestId" IS NULL OR ("orderId" IS NOT NULL AND "bookingId" IS NULL AND "vehicleTransactionId" IS NULL));
CREATE INDEX "Invoice_guestId_createdAt_idx" ON "Invoice"("guestId", "createdAt");

ALTER TABLE "OrderAftercareRequest" ADD COLUMN "guestId" UUID;
ALTER TABLE "OrderAftercareRequest" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "OrderAftercareRequest" ADD CONSTRAINT "OrderAftercareRequest_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "PurchaseGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderAftercareRequest" ADD CONSTRAINT "OrderAftercareRequest_exactly_one_buyer"
  CHECK (num_nonnulls("customerId", "guestId") = 1);

-- New guest-directed quotations explicitly snapshot their intended recipient.
-- Existing account quotations remain NULL and cannot be claimed by email proof.
ALTER TABLE "PartsQuote" ADD COLUMN "guestEmail" CITEXT;
CREATE INDEX "PartsQuote_guestEmail_createdAt_idx" ON "PartsQuote"("guestEmail", "createdAt");

-- Preserve every existing tax, deposit-credit, currency and source check.
-- Orders may have a guest owner; booking/vehicle invoices still require accounts.
CREATE OR REPLACE FUNCTION aat_validate_invoice_source_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_customer UUID;
  expected_guest UUID;
  expected_currency CHAR(3);
  expected_subtotal BIGINT;
  expected_tax BIGINT;
  expected_credit BIGINT := 0;
  expected_total BIGINT;
  pending_refunds INTEGER := 0;
BEGIN
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "customerId", "guestId", "currency", "totalKobo" - "taxKobo", "taxKobo", 0, "totalKobo"
      INTO expected_customer, expected_guest, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "Order" WHERE "id" = NEW."orderId";
  ELSIF NEW."bookingId" IS NOT NULL THEN
    SELECT b."customerId", q."currency", q."subtotalKobo", q."taxKobo",
      CASE WHEN b."bookingSlotId" IS NULL THEN 0 ELSE LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo") END,
      q."totalKobo" - CASE WHEN b."bookingSlotId" IS NULL THEN 0 ELSE LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo") END,
      COALESCE(refunds.pending, 0)
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total, pending_refunds
      FROM "Booking" b
      JOIN "ServiceQuote" q ON q."bookingId" = b."id" AND q."status" = 'ACCEPTED'
      LEFT JOIN "Payment" p ON p."bookingId" = b."id" AND p."status" = 'SUCCEEDED'
      LEFT JOIN (
        SELECT pa."paymentId",
          COALESCE(SUM(r."amountKobo") FILTER (WHERE r."status" = 'SUCCEEDED'), 0) AS refunded,
          COUNT(*) FILTER (WHERE r."status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')) AS pending
        FROM "PaymentAttempt" pa LEFT JOIN "Refund" r ON r."paymentAttemptId" = pa."id"
        GROUP BY pa."paymentId"
      ) refunds ON refunds."paymentId" = p."id"
      WHERE b."id" = NEW."bookingId"
        AND (b."bookingSlotId" IS NULL OR b."depositPolicyVersion" = 'owner-booking-request-v2' OR (b."depositPaidAt" IS NOT NULL AND b."depositForfeitedAt" IS NULL));
  ELSIF NEW."vehicleTransactionId" IS NOT NULL THEN
    SELECT "customerId", "currency", "agreedPriceKobo", 0, 0, "agreedPriceKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "VehicleTransaction" WHERE "id" = NEW."vehicleTransactionId";
  END IF;

  IF pending_refunds > 0 THEN
    RAISE EXCEPTION 'Invoice cannot snapshot a booking deposit while a refund is pending';
  END IF;
  IF num_nonnulls(expected_customer, expected_guest) <> 1
    OR expected_credit < 0
    OR NEW."customerId" IS DISTINCT FROM expected_customer
    OR NEW."guestId" IS DISTINCT FROM expected_guest
    OR NEW."currency" IS DISTINCT FROM expected_currency
    OR NEW."subtotalKobo" IS DISTINCT FROM expected_subtotal
    OR NEW."taxKobo" IS DISTINCT FROM expected_tax
    OR NEW."depositCreditKobo" IS DISTINCT FROM expected_credit
    OR NEW."totalKobo" IS DISTINCT FROM expected_total THEN
    RAISE EXCEPTION 'Invoice source, customer, currency, and amount snapshot must match server truth';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION aat_protect_purchase_guest_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."guestId" IS DISTINCT FROM OLD."guestId" THEN
    RAISE EXCEPTION 'Guest purchase ownership is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Order_guest_owner_immutable" BEFORE UPDATE OF "guestId" ON "Order"
  FOR EACH ROW EXECUTE FUNCTION aat_protect_purchase_guest_owner();
CREATE TRIGGER "Invoice_guest_owner_immutable" BEFORE UPDATE OF "guestId" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION aat_protect_purchase_guest_owner();
CREATE TRIGGER "OrderAftercareRequest_guest_owner_immutable" BEFORE UPDATE OF "guestId" ON "OrderAftercareRequest"
  FOR EACH ROW EXECUTE FUNCTION aat_protect_purchase_guest_owner();

CREATE FUNCTION aat_validate_aftercare_purchase_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."id" = NEW."orderId"
    AND o."customerId" IS NOT DISTINCT FROM NEW."customerId"
    AND o."guestId" IS NOT DISTINCT FROM NEW."guestId") THEN
    RAISE EXCEPTION 'Aftercare ownership must match the original purchase';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "OrderAftercareRequest_buyer_matches_order"
  BEFORE INSERT OR UPDATE OF "orderId", "customerId", "guestId" ON "OrderAftercareRequest"
  FOR EACH ROW EXECUTE FUNCTION aat_validate_aftercare_purchase_owner();

CREATE FUNCTION aat_protect_guest_quote_recipient() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."guestEmail" IS DISTINCT FROM OLD."guestEmail" THEN
    RAISE EXCEPTION 'Quotation guest recipient is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PartsQuote_guest_recipient_immutable" BEFORE UPDATE OF "guestEmail" ON "PartsQuote"
  FOR EACH ROW EXECUTE FUNCTION aat_protect_guest_quote_recipient();

COMMIT;
