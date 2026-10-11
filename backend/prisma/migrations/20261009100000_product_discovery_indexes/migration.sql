-- Existing public product keyset/price/trigram indexes are reused.
-- Prefix options use expression indexes without adding another extension.
CREATE INDEX "Category_discovery_name_idx" ON "Category" (lower("name") COLLATE "C", "id") WHERE "isActive" = true;
CREATE INDEX "Product_discovery_brand_idx" ON "Product" (lower("brand") COLLATE "C", "categoryId") WHERE "isActive" = true AND "brand" IS NOT NULL;
CREATE INDEX "ProductCompatibility_discovery_make_model_idx" ON "ProductCompatibility" (lower("make") COLLATE "C", lower("model") COLLATE "C", "productId");
CREATE INDEX "Inventory_public_available_product_idx" ON "Inventory" ("productId", "branchId") WHERE "quantity" > "reserved";
