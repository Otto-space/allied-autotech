-- Add an explicit, version-bound proposal; existing appointments are unchanged.
ALTER TABLE "Booking"
  ADD COLUMN "alternativeStartsAt" TIMESTAMP(3),
  ADD COLUMN "alternativeReason" VARCHAR(1000),
  ADD COLUMN "alternativeVersion" INTEGER;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_alternative_complete_check" CHECK (
  ("alternativeStartsAt" IS NULL AND "alternativeReason" IS NULL AND "alternativeVersion" IS NULL)
  OR ("alternativeStartsAt" IS NOT NULL AND "alternativeReason" IS NOT NULL AND "alternativeVersion" IS NOT NULL AND "alternativeVersion" >= 0)
);
