-- Derived normalized public brand key, never a new/inferred brand identity.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Product" ADD COLUMN "brandKey" TEXT;
CREATE FUNCTION aat_product_brand_key() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW."brandKey" := NULLIF(aat_search_normalize(NEW."brand"), '');
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Product_brand_key" BEFORE INSERT OR UPDATE OF "brand", "brandKey" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION aat_product_brand_key();
UPDATE "Product" SET "brandKey" = NULLIF(aat_search_normalize("brand"), '');
CREATE INDEX "Product_brand_key_category_idx" ON "Product"("brandKey", "categoryId");
COMMIT;
