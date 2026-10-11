-- Preserve document identity and line descriptions without rewriting legacy invoices.
ALTER TABLE "Invoice" ADD COLUMN "documentSnapshot" JSONB;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_document_snapshot_object"
  CHECK ("documentSnapshot" IS NULL OR jsonb_typeof("documentSnapshot") = 'object');

CREATE FUNCTION aat_protect_invoice_document_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."documentSnapshot" IS DISTINCT FROM OLD."documentSnapshot" THEN
    RAISE EXCEPTION 'Invoice document snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Invoice_protect_document_snapshot"
BEFORE UPDATE ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION aat_protect_invoice_document_snapshot();
