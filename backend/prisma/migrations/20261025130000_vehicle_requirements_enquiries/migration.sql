-- Compatible expansion. Existing listing enquiries keep their references and
-- nullable legacy intent; no business row is rewritten. New requirements requests
-- are explicit, branch-routed and cannot disguise a failed listing lookup.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TYPE "VehicleEnquiryIntent" AS ENUM ('LISTING', 'REQUIREMENTS');
ALTER TABLE "Enquiry" ADD COLUMN "vehicleEnquiryIntent" "VehicleEnquiryIntent";
ALTER TABLE "Enquiry"
  DROP CONSTRAINT "aat_enquiry_target_valid",
  ADD CONSTRAINT "aat_enquiry_target_valid" CHECK (
    ("type" = 'GENERAL' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'PRODUCT' AND ("productId" IS NOT NULL OR "customerId" IS NULL) AND num_nonnulls("serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'VEHICLE' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId") = 0 AND (
      (("vehicleEnquiryIntent" IS NULL OR "vehicleEnquiryIntent" = 'LISTING') AND "vehicleListingId" IS NOT NULL)
      OR ("vehicleEnquiryIntent" IS NOT NULL AND "vehicleEnquiryIntent" = 'REQUIREMENTS' AND "vehicleListingId" IS NULL AND "branchId" IS NOT NULL)
    ))
    OR ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND num_nonnulls("productId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'BOOKING' AND "customerId" IS NOT NULL AND "bookingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'QUOTATION' AND "customerId" IS NOT NULL AND "quoteId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "vehicleListingId") = 0)
  ),
  ADD CONSTRAINT "aat_enquiry_vehicle_intent_valid" CHECK (
    "type" = 'VEHICLE' OR "vehicleEnquiryIntent" IS NULL
  );

COMMIT;
