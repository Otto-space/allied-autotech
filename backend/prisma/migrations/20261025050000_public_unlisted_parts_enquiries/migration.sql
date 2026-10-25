-- Expand only anonymous/public PRODUCT enquiries to allow an unlisted part.
-- All previously valid rows remain valid. Customer-linked PRODUCT enquiries and
-- every other source requirement retain their existing database checks.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE "Enquiry"
  DROP CONSTRAINT "aat_enquiry_target_valid",
  ADD CONSTRAINT "aat_enquiry_target_valid" CHECK (
    ("type" = 'GENERAL' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'PRODUCT' AND ("productId" IS NOT NULL OR "customerId" IS NULL) AND num_nonnulls("serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'VEHICLE' AND "vehicleListingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId") = 0)
    OR ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND num_nonnulls("productId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'BOOKING' AND "customerId" IS NOT NULL AND "bookingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'QUOTATION' AND "customerId" IS NOT NULL AND "quoteId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "vehicleListingId") = 0)
  );

COMMIT;
