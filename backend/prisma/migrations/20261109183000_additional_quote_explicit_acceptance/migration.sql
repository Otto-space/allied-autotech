-- Private explicit consent is additive. Historical records are never invented/backfilled.
ALTER TABLE "ServiceQuote" ADD COLUMN "acceptedAdditionalContext" JSONB,
 ADD CONSTRAINT "ServiceQuote_additional_acceptance_shape" CHECK (
  "acceptedAdditionalContext" IS NULL OR
  ("originalInvoiceId" IS NOT NULL AND "status"='ACCEPTED' AND jsonb_typeof("acceptedAdditionalContext")='object')
 );
CREATE FUNCTION aat_validate_additional_quote_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected JSONB;
BEGIN
 IF TG_OP='UPDATE' AND OLD."acceptedAdditionalContext" IS NOT NULL
    AND NEW."acceptedAdditionalContext" IS DISTINCT FROM OLD."acceptedAdditionalContext" THEN
   RAISE EXCEPTION 'Accepted additional-work acknowledgement is immutable';
 END IF;
 IF NEW."originalInvoiceId" IS NULL THEN
   IF NEW."acceptedAdditionalContext" IS NOT NULL THEN
     RAISE EXCEPTION 'Original quotations cannot carry additional-work acknowledgement';
   END IF;
 ELSIF NEW."status"='ACCEPTED' AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status"
    OR NEW."acceptedAdditionalContext" IS DISTINCT FROM OLD."acceptedAdditionalContext"
    OR NEW."version" IS DISTINCT FROM OLD."version" OR NEW."bookingId" IS DISTINCT FROM OLD."bookingId") THEN
   SELECT jsonb_build_object('kind','ADDITIONAL_WORK','invoiceNumber',i."invoiceNumber",
      'quoteVersion',NEW."version",'reason',NEW."amendmentReason",'customerUserId',c."userId") INTO expected
    FROM "Invoice" i JOIN "Booking" b ON b."id"=i."bookingId"
    JOIN "CustomerProfile" c ON c."id"=b."customerId"
    WHERE i."id"=NEW."originalInvoiceId" AND b."id"=NEW."bookingId";
   IF expected IS NULL OR NEW."acceptedAdditionalContext" IS DISTINCT FROM expected THEN
     RAISE EXCEPTION 'Explicit current additional-work acknowledgement is required';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "ServiceQuote_additional_acceptance_validate"
 BEFORE INSERT OR UPDATE OF "status","acceptedAdditionalContext","version","bookingId","originalInvoiceId","amendmentReason"
 ON "ServiceQuote" FOR EACH ROW EXECUTE FUNCTION aat_validate_additional_quote_acceptance();

-- A legacy client/runtime cannot rewrite an invoiced original agreement.
CREATE FUNCTION aat_preserve_invoiced_booking_price() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."quotedPriceKobo" IS DISTINCT FROM OLD."quotedPriceKobo"
    AND EXISTS (SELECT 1 FROM "Invoice" WHERE "bookingId"=NEW."id") THEN
   RAISE EXCEPTION 'The invoiced original booking price is immutable; use additional-work agreements';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Booking_invoiced_original_price_preserve"
 BEFORE UPDATE OF "quotedPriceKobo" ON "Booking"
 FOR EACH ROW EXECUTE FUNCTION aat_preserve_invoiced_booking_price();
