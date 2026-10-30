-- Expand booking intake without replacing existing services or booking history.
ALTER TABLE "Booking" ADD COLUMN "customerConcern" VARCHAR(2000);
ALTER TABLE "Booking" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_service_or_concern_check"
  CHECK ("serviceId" IS NOT NULL OR length(btrim("customerConcern")) >= 10 AND "customerConcern" IS NOT NULL);
