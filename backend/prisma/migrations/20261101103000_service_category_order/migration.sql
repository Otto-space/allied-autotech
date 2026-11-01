-- Additive ordering: existing categories retain alphabetical ties at zero.
ALTER TABLE "ServiceCategory" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_sortOrder_check"
  CHECK ("sortOrder" >= 0 AND "sortOrder" <= 1000000);
CREATE INDEX "ServiceCategory_isActive_sortOrder_name_id_idx"
  ON "ServiceCategory"("isActive", "sortOrder", "name", "id");
DROP INDEX "ServiceCategory_isActive_name_id_idx";
