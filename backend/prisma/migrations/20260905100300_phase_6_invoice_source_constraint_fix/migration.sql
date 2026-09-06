-- Remove the obsolete two-source invariant superseded by aat_invoice_exactly_one_source.
ALTER TABLE "Invoice"
  DROP CONSTRAINT "Invoice_exactly_one_source";
