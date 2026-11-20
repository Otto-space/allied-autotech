-- Additive scope binding: original invoices, issued amounts and payments stay intact.
ALTER TABLE "ServiceQuote"
 ADD COLUMN "originalInvoiceId" UUID,
 ADD COLUMN "amendmentReason" VARCHAR(1000),
 ADD CONSTRAINT "ServiceQuote_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "ServiceQuote_additional_work_context" CHECK (
  ("originalInvoiceId" IS NULL AND "amendmentReason" IS NULL)
  OR ("originalInvoiceId" IS NOT NULL AND "amendmentReason" IS NOT NULL AND length(btrim("amendmentReason")) BETWEEN 1 AND 1000)
 );
CREATE INDEX "ServiceQuote_originalInvoiceId_idx" ON "ServiceQuote"("originalInvoiceId");

-- Keep the original one-accepted-base invariant continuously protected. Accepted
-- additions have distinct immutable scope bindings; they do not replace that base.
CREATE UNIQUE INDEX "ServiceQuote_accepted_original_scope_key" ON "ServiceQuote"("bookingId")
 WHERE "status"='ACCEPTED' AND "originalInvoiceId" IS NULL;
DROP INDEX "ServiceQuote_one_accepted_per_booking_key";
ALTER INDEX "ServiceQuote_accepted_original_scope_key" RENAME TO "ServiceQuote_one_accepted_per_booking_key";

CREATE FUNCTION aat_validate_additional_service_quote() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original "Invoice"%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND (NEW."originalInvoiceId" IS DISTINCT FROM OLD."originalInvoiceId"
    OR NEW."amendmentReason" IS DISTINCT FROM OLD."amendmentReason") THEN
   RAISE EXCEPTION 'Quotation amendment context is immutable; prepare a reviewed new draft version';
 END IF;
 IF NEW."originalInvoiceId" IS NOT NULL THEN
   SELECT * INTO original FROM "Invoice" WHERE "id"=NEW."originalInvoiceId" FOR SHARE;
   IF original."bookingId" IS DISTINCT FROM NEW."bookingId" OR original."id" IS NULL THEN
     RAISE EXCEPTION 'Additional work must refer to the original invoice for this booking';
   END IF;
   IF NEW."status" IN ('DRAFT','ISSUED','ACCEPTED') AND original."status" NOT IN ('ISSUED','PAID') THEN
     RAISE EXCEPTION 'Additional work requires an issued original invoice';
   END IF;
 ELSIF NEW."status" IN ('DRAFT','ISSUED','ACCEPTED') AND EXISTS (
   SELECT 1 FROM "Invoice" WHERE "bookingId"=NEW."bookingId"
 ) AND (TG_OP='INSERT' OR NEW."status" IS DISTINCT FROM OLD."status") THEN
   RAISE EXCEPTION 'An invoice already records the original scope; use an explicit additional-work quotation';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "ServiceQuote_additional_work_validate"
 BEFORE INSERT OR UPDATE OF "bookingId","originalInvoiceId","amendmentReason","status"
 ON "ServiceQuote" FOR EACH ROW EXECUTE FUNCTION aat_validate_additional_service_quote();

-- The source-snapshot function below retains the prior guest, currency, tax,
-- credit/refund and amount guards. Only original accepted quotations supply the
-- original invoice; additional accepted work must never replace its source.

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
      JOIN "ServiceQuote" q ON q."bookingId" = b."id" AND q."status" = 'ACCEPTED' AND q."originalInvoiceId" IS NULL
      LEFT JOIN "Payment" p ON p."bookingId" = b."id" AND p."status" = 'SUCCEEDED'
      LEFT JOIN (
        SELECT pa."paymentId",
          COALESCE(SUM(r."amountKobo") FILTER (WHERE r."status" = 'SUCCEEDED'), 0) AS refunded,
          COUNT(*) FILTER (WHERE r."status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')) AS pending
        FROM "PaymentAttempt" pa LEFT JOIN "Refund" r ON r."paymentAttemptId" = pa."id"
        GROUP BY pa."paymentId"
      ) refunds ON refunds."paymentId" = p."id"
      WHERE b."id" = NEW."bookingId"
        AND (b."bookingSlotId" IS NULL OR b."depositPolicyVersion" = 'owner-booking-request-v2' OR (b."depositPaidAt" IS NOT NULL AND b."depositForfeitedAt" IS NULL)) ORDER BY q."version" DESC LIMIT 1;
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
