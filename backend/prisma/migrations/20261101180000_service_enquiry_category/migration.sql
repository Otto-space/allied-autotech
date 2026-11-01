BEGIN;
SET LOCAL lock_timeout = '10s';
-- Additive: preserve existing enquiries and commercial snapshots.
ALTER TABLE "Enquiry" ADD COLUMN "serviceCategoryId" UUID;
CREATE INDEX "Enquiry_serviceCategoryId_idx" ON "Enquiry"("serviceCategoryId");
ALTER TABLE "Enquiry" ADD CONSTRAINT "Enquiry_serviceCategoryId_fkey"
  FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Enquiry"
  DROP CONSTRAINT "aat_enquiry_target_valid",
  ADD CONSTRAINT "aat_enquiry_target_valid" CHECK (
    ("type" = 'GENERAL' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'PRODUCT' AND num_nonnulls("serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'VEHICLE' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId") = 0 AND (
      (("vehicleEnquiryIntent" IS NULL OR "vehicleEnquiryIntent" = 'LISTING') AND "vehicleListingId" IS NOT NULL)
      OR ("vehicleEnquiryIntent" IS NOT NULL AND "vehicleEnquiryIntent" = 'REQUIREMENTS' AND "vehicleListingId" IS NULL AND "branchId" IS NOT NULL)
    ))
    OR ("type" = 'SERVICE' AND num_nonnulls("serviceId", "serviceCategoryId") >= 1 AND num_nonnulls("productId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'BOOKING' AND "customerId" IS NOT NULL AND "bookingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'QUOTATION' AND "customerId" IS NOT NULL AND "quoteId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "vehicleListingId") = 0)
  );
ALTER TABLE "Enquiry" ADD CONSTRAINT "aat_enquiry_category_type_valid" CHECK ("serviceCategoryId" IS NULL OR "type" = 'SERVICE');
COMMIT;
