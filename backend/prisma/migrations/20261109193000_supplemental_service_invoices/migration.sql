-- Preserve each original sale; one new accepted addition can source at most one
-- separate invoice, with no inherited deposit credit or client-supplied amounts.
ALTER TABLE "Invoice" ADD COLUMN "additionalQuoteId" UUID,
 ADD CONSTRAINT "Invoice_additionalQuoteId_fkey" FOREIGN KEY ("additionalQuoteId") REFERENCES "ServiceQuote"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE UNIQUE INDEX "Invoice_additionalQuoteId_key" ON "Invoice"("additionalQuoteId");
ALTER TABLE "Invoice" ADD CONSTRAINT "aat_invoice_four_sources" CHECK
 (num_nonnulls("orderId","bookingId","vehicleTransactionId","additionalQuoteId")=1);
ALTER TABLE "Invoice" DROP CONSTRAINT "aat_invoice_exactly_one_source";
ALTER TABLE "Invoice" RENAME CONSTRAINT "aat_invoice_four_sources" TO "aat_invoice_exactly_one_source";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplement_no_credit_or_guest" CHECK
 ("additionalQuoteId" IS NULL OR ("depositCreditKobo"=0 AND "guestId" IS NULL));

CREATE FUNCTION aat_preserve_supplemental_invoice_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."additionalQuoteId" IS DISTINCT FROM OLD."additionalQuoteId" THEN
   RAISE EXCEPTION 'A supplemental invoice source is immutable, including in draft';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Invoice_supplemental_source_immutable" BEFORE UPDATE OF "additionalQuoteId" ON "Invoice"
 FOR EACH ROW EXECUTE FUNCTION aat_preserve_supplemental_invoice_source();

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
  ELSIF NEW."additionalQuoteId" IS NOT NULL THEN
    SELECT b."customerId", q."currency", q."subtotalKobo", q."taxKobo", 0, q."totalKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "ServiceQuote" q JOIN "Booking" b ON b."id"=q."bookingId"
      JOIN "Invoice" original ON original."id"=q."originalInvoiceId" AND original."bookingId"=b."id"
      JOIN "CustomerProfile" c ON c."id"=b."customerId"
      WHERE q."id"=NEW."additionalQuoteId" AND q."status"='ACCEPTED' AND q."acceptedAt" IS NOT NULL
      AND original."status" IN ('ISSUED','PAID') AND b."status"<>'CANCELLED'
      AND q."acceptedAdditionalContext" = jsonb_build_object('kind','ADDITIONAL_WORK',
        'invoiceNumber',original."invoiceNumber",'quoteVersion',q."version",
        'reason',q."amendmentReason",'customerUserId',c."userId");
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

-- Retain every original snapshot guard and additionally validate the new source.
DROP TRIGGER "Invoice_validate_source_snapshot" ON "Invoice";
CREATE TRIGGER "Invoice_validate_source_snapshot"
 BEFORE INSERT OR UPDATE OF "customerId","guestId","orderId","bookingId","vehicleTransactionId","additionalQuoteId","currency","subtotalKobo","taxKobo","depositCreditKobo","totalKobo"
 ON "Invoice" FOR EACH ROW EXECUTE FUNCTION aat_validate_invoice_source_snapshot();

CREATE FUNCTION aat_validate_supplemental_invoice_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."additionalQuoteId" IS NOT NULL AND NEW."status" IN ('ISSUED','PAID') AND NOT EXISTS (
   SELECT 1 FROM "ServiceQuote" q JOIN "Booking" b ON b."id"=q."bookingId"
   JOIN "Invoice" original ON original."id"=q."originalInvoiceId" AND original."bookingId"=b."id"
   JOIN "CustomerProfile" c ON c."id"=b."customerId"
   WHERE q."id"=NEW."additionalQuoteId" AND q."status"='ACCEPTED' AND q."acceptedAt" IS NOT NULL
   AND original."status" IN ('ISSUED','PAID') AND b."status"<>'CANCELLED'
   AND q."acceptedAdditionalContext"=jsonb_build_object('kind','ADDITIONAL_WORK','invoiceNumber',original."invoiceNumber",
     'quoteVersion',q."version",'reason',q."amendmentReason",'customerUserId',c."userId")
 ) THEN RAISE EXCEPTION 'The separate invoice requires its current accepted additional-work agreement';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Invoice_supplemental_state_validate" BEFORE INSERT OR UPDATE OF "status" ON "Invoice"
 FOR EACH ROW EXECUTE FUNCTION aat_validate_supplemental_invoice_state();

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_supplement_saved_plan" CHECK (
 "additionalQuoteId" IS NULL OR COALESCE(
  "documentSnapshot" IS NOT NULL
  AND "documentSnapshot"->'source'->>'type'='SERVICE_ADDITION'
  AND "documentSnapshot"->'source'->>'id'="additionalQuoteId"::text
  AND length("documentSnapshot"->'source'->>'originalInvoiceNumber') BETWEEN 1 AND 50
  AND length("documentSnapshot"->'source'->>'amendmentReason') BETWEEN 1 AND 1000
  AND jsonb_typeof("documentSnapshot"->'servicePaymentPlan')='object'
  AND "documentSnapshot"->'servicePaymentPlan'->>'quoteId'="additionalQuoteId"::text
 ,false)
);
