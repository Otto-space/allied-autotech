-- Preserve original customer group intent without rewriting existing bookings.
ALTER TABLE "Booking" ADD COLUMN "requestedServiceCategoryId" UUID,
  ADD COLUMN "requestedServiceCategoryName" TEXT;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requestedServiceCategoryId_fkey"
  FOREIGN KEY ("requestedServiceCategoryId") REFERENCES "ServiceCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_requested_service_group_pair"
  CHECK (("requestedServiceCategoryId" IS NULL AND "requestedServiceCategoryName" IS NULL)
    OR ("requestedServiceCategoryId" IS NOT NULL AND "requestedServiceCategoryName" IS NOT NULL
      AND length(btrim("requestedServiceCategoryName")) > 0));
CREATE INDEX "Booking_requestedServiceCategoryId_idx" ON "Booking"("requestedServiceCategoryId");
