-- Index the exact Phase 4 search and operational filter shapes.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX "Product_active_name_trgm_idx"
  ON "Product" USING GIN ("name" gin_trgm_ops)
  WHERE "isActive" = true;
CREATE INDEX "Product_active_sku_trgm_idx"
  ON "Product" USING GIN ("sku" gin_trgm_ops)
  WHERE "isActive" = true;
CREATE INDEX "Product_active_brand_trgm_idx"
  ON "Product" USING GIN ("brand" gin_trgm_ops)
  WHERE "isActive" = true AND "brand" IS NOT NULL;
CREATE INDEX "Product_active_part_number_trgm_idx"
  ON "Product" USING GIN ("manufacturerPartNumber" gin_trgm_ops)
  WHERE "isActive" = true AND "manufacturerPartNumber" IS NOT NULL;

CREATE INDEX "ProductCompatibility_make_model_trgm_idx"
  ON "ProductCompatibility" USING GIN
  ((COALESCE("make", '') || ' ' || COALESCE("model", '')) gin_trgm_ops);

CREATE INDEX "Inventory_low_stock_branch_id_idx"
  ON "Inventory" ("branchId", "id")
  WHERE ("quantity" - "reserved") <= "reorderLevel";
