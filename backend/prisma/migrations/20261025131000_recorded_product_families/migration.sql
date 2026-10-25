-- No inferred family/specification backfill. Existing products remain shared and
-- browseable with explicit unknown values until an authorised data review.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TYPE "ProductFamily" AS ENUM ('REPLACEMENT_PART', 'ENGINE_OIL');
ALTER TABLE "Category" ADD COLUMN "family" "ProductFamily";
ALTER TABLE "Product"
  ADD COLUMN "family" "ProductFamily",
  ADD COLUMN "oilViscosityGrade" VARCHAR(12),
  ADD COLUMN "packVolumeMl" INTEGER,
  ADD CONSTRAINT "aat_product_oil_fields_valid" CHECK (
    ("oilViscosityGrade" IS NULL AND "packVolumeMl" IS NULL)
    OR ("family" IS NOT NULL AND "family" = 'ENGINE_OIL'
      AND ("oilViscosityGrade" IS NULL OR "oilViscosityGrade" ~ '^(0|5|10|15|20|25)W-(8|12|16|20|30|40|50|60)$')
      AND ("packVolumeMl" IS NULL OR "packVolumeMl" BETWEEN 1 AND 1000000))
  ),
  ADD CONSTRAINT "aat_product_oil_classification_valid" CHECK (
    "family" IS DISTINCT FROM 'ENGINE_OIL' OR ("condition" IS NULL AND "classification" IS NULL)
  );
CREATE INDEX "Product_family_isActive_idx" ON "Product"("family", "isActive");
COMMIT;
