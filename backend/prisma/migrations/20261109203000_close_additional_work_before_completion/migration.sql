-- An earlier completion cannot prove completion of newly agreed work.
-- Preserve all existing records, original invoice paths and later settlement.
CREATE FUNCTION aat_additional_work_open(booking UUID) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE closed boolean;
BEGIN
 SELECT b."status" IN ('CANCELLED','COMPLETED') OR COALESCE(w."status"='COMPLETED' OR w."completedAt" IS NOT NULL,false)
 INTO closed FROM "Booking" b LEFT JOIN "WorkOrder" w ON w."bookingId"=b."id"
 WHERE b."id"=booking FOR SHARE OF b;
 RETURN NOT COALESCE(closed,true);
END; $$;
CREATE FUNCTION aat_preserve_additional_agreement_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."originalInvoiceId" IS NOT NULL AND NEW."status"='ACCEPTED'
    AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status")
    AND NOT aat_additional_work_open(NEW."bookingId") THEN
   RAISE EXCEPTION 'Additional work requires agreement before the visit work is complete';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "ServiceQuote_additional_completion_guard" BEFORE INSERT OR UPDATE OF "status" ON "ServiceQuote"
 FOR EACH ROW EXECUTE FUNCTION aat_preserve_additional_agreement_completion();

CREATE FUNCTION aat_preserve_supplemental_invoice_review() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE booking UUID;
BEGIN
 IF NEW."additionalQuoteId" IS NULL THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW."status"<>'DRAFT' THEN
   RAISE EXCEPTION 'Prepare and review the additional invoice as a draft before issuing';
 END IF;
 IF TG_OP='UPDATE' AND NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
   (OLD."status"='DRAFT' AND NEW."status" IN ('ISSUED','VOID')) OR
   (OLD."status"='ISSUED' AND NEW."status" IN ('PAID','VOID'))
 ) THEN RAISE EXCEPTION 'Invalid additional invoice lifecycle transition'; END IF;
 IF NEW."status"='VOID' AND (TG_OP='INSERT' OR OLD."status" IS DISTINCT FROM NEW."status")
    AND EXISTS(SELECT 1 FROM "Payment" WHERE "invoiceId"=NEW."id" AND "status"='SUCCEEDED') THEN
   RAISE EXCEPTION 'Preserve received additional payments and use financial review';
 END IF;
 IF TG_OP='INSERT' OR (OLD."status"='DRAFT' AND NEW."status"='ISSUED') THEN
   SELECT "bookingId" INTO booking FROM "ServiceQuote" WHERE "id"=NEW."additionalQuoteId";
   IF NOT aat_additional_work_open(booking) THEN
     RAISE EXCEPTION 'An additional invoice must be reviewed before its visit work is complete';
   END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Invoice_supplemental_review_guard" BEFORE INSERT OR UPDATE OF "status" ON "Invoice"
 FOR EACH ROW EXECUTE FUNCTION aat_preserve_supplemental_invoice_review();
