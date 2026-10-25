-- Derived public search documents. These fields are maintained at the database
-- boundary, including old application writers. No product specification, stock,
-- publication, audit identifier, price or business timestamp is inferred/changed.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TABLE "Product"
  ADD COLUMN "searchCore" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "searchDocument" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "searchNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "searchIdentifiers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "VehicleListing"
  ADD COLUMN "searchCore" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "searchDocument" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "searchNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE FUNCTION aat_search_normalize(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(regexp_replace(btrim(normalize(coalesce(value, ''), NFKC)), '[[:space:]]+', ' ', 'g'));
$$;
CREATE FUNCTION aat_search_words(value TEXT) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE found TEXT[]; word TEXT; result TEXT := ' '; source TEXT;
BEGIN
  source := regexp_replace(aat_search_normalize(value), '\mmotor[[:space:]]+oil\M', 'engine oil', 'g');
  FOR found IN SELECT regexp_matches(source, '([[:alnum:]]+([._/-][[:alnum:]]+)*)', 'g') LOOP
    word := found[1];
    IF word ~ '^(0|5|10|15|20|25)w-?(8|12|16|20|30|40|50|60)$' THEN
      word := replace(word, '-', '');
    ELSIF word !~ '[0-9]' THEN
      word := regexp_replace(word, '[._/-]+', ' ', 'g');
    END IF;
    result := result || word || ' ';
  END LOOP;
  RETURN result;
END;
$$;

CREATE FUNCTION aat_product_search_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE category_labels TEXT;
BEGIN
  SELECT concat_ws(' ', c."name", parent."name") INTO category_labels
    FROM "Category" c LEFT JOIN "Category" parent ON parent."id" = c."parentId"
    WHERE c."id" = NEW."categoryId";
  NEW."searchCore" := aat_search_words(concat_ws(' ', NEW."name", NEW."brand", category_labels,
    NEW."productType", NEW."oilViscosityGrade", CASE WHEN NEW."family" = 'ENGINE_OIL' THEN 'engine oil' END));
  NEW."searchDocument" := NEW."searchCore" || aat_search_words(NEW."description");
  NEW."searchNames" := ARRAY[aat_search_normalize(NEW."name")];
  NEW."searchIdentifiers" := array_remove(ARRAY[aat_search_normalize(NEW."sku"), aat_search_normalize(NEW."manufacturerPartNumber")], '');
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Product_search_document" BEFORE INSERT OR UPDATE OF "name", "brand", "categoryId", "productType", "family", "oilViscosityGrade", "sku", "manufacturerPartNumber", "description", "searchCore", "searchDocument", "searchNames", "searchIdentifiers"
  ON "Product" FOR EACH ROW EXECUTE FUNCTION aat_product_search_document();
CREATE FUNCTION aat_category_search_refresh() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "Product" SET "searchCore" = "searchCore"
    WHERE "categoryId" = NEW."id" OR "categoryId" IN (SELECT "id" FROM "Category" WHERE "parentId" = NEW."id");
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Category_search_refresh" AFTER UPDATE OF "name", "parentId" ON "Category"
  FOR EACH ROW EXECUTE FUNCTION aat_category_search_refresh();

CREATE FUNCTION aat_vehicle_search_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE vehicle_row "Vehicle"%ROWTYPE;
BEGIN
  SELECT * INTO vehicle_row FROM "Vehicle" WHERE "id" = NEW."vehicleId";
  NEW."searchCore" := aat_search_words(concat_ws(' ', NEW."title", vehicle_row."make", vehicle_row."model",
    vehicle_row."trim", vehicle_row."bodyType", vehicle_row."transmission", vehicle_row."fuelType"));
  NEW."searchDocument" := NEW."searchCore" || aat_search_words(NEW."description");
  NEW."searchNames" := ARRAY[aat_search_normalize(NEW."title"), aat_search_normalize(concat_ws(' ', vehicle_row."make", vehicle_row."model"))];
  RETURN NEW;
END;
$$;
CREATE TRIGGER "VehicleListing_search_document" BEFORE INSERT OR UPDATE OF "title", "description", "vehicleId", "searchCore", "searchDocument", "searchNames"
  ON "VehicleListing" FOR EACH ROW EXECUTE FUNCTION aat_vehicle_search_document();
CREATE FUNCTION aat_vehicle_search_refresh() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "VehicleListing" SET "searchCore" = "searchCore" WHERE "vehicleId" = NEW."id";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Vehicle_search_refresh" AFTER UPDATE OF "make", "model", "trim", "bodyType", "transmission", "fuelType" ON "Vehicle"
  FOR EACH ROW EXECUTE FUNCTION aat_vehicle_search_refresh();

-- Rebuild only new derived columns; null/ambiguous product family remains unknown.
UPDATE "Product" SET "searchCore" = '';
UPDATE "VehicleListing" SET "searchCore" = '';
-- pg_trgm already belongs to the reviewed migration history.
CREATE INDEX "Product_search_document_idx" ON "Product" USING GIN ("searchDocument" gin_trgm_ops);
CREATE INDEX "Product_search_identifiers_idx" ON "Product" USING GIN ("searchIdentifiers");
CREATE INDEX "VehicleListing_search_document_idx" ON "VehicleListing" USING GIN ("searchDocument" gin_trgm_ops);
COMMIT;
