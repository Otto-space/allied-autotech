-- Additive evidence. Keep historical rows and compatible old quantity-only writers.
-- No financial hold is released by this migration. Resolved-quantity handling must
-- explicitly extend this dense-prefix guard before permitting refunded gaps.
ALTER TABLE "OrderPickupHandover" ADD COLUMN "unitRanges" JSONB;
CREATE FUNCTION aat_validate_pickup_unit_ranges() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE piece JSONB; actual JSONB; prior_count BIGINT; original_count INTEGER;
BEGIN
 IF NEW."unitRanges" IS NULL THEN RETURN NEW; END IF;
 PERFORM 1 FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF jsonb_typeof(NEW."unitRanges") IS DISTINCT FROM 'array' OR jsonb_array_length(NEW."unitRanges")<>jsonb_array_length(NEW."lines")
   OR jsonb_array_length(NEW."unitRanges")<>(SELECT count(DISTINCT value->>'orderItemId') FROM jsonb_array_elements(NEW."unitRanges"))
 THEN RAISE EXCEPTION 'Pickup unit evidence must match each actual handed-over line'; END IF;
 FOR piece IN SELECT value FROM jsonb_array_elements(NEW."unitRanges") LOOP
  SELECT value INTO actual FROM jsonb_array_elements(NEW."lines") WHERE value->>'orderItemId'=piece->>'orderItemId';
  SELECT "quantity" INTO original_count FROM "OrderItem" WHERE "orderId"=NEW."orderId" AND "id"::text=piece->>'orderItemId';
  SELECT COALESCE(sum((line->>'quantity')::integer),0) INTO prior_count FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") line
   WHERE h."orderId"=NEW."orderId" AND line->>'orderItemId'=piece->>'orderItemId';
  IF jsonb_typeof(piece) IS DISTINCT FROM 'object' OR original_count IS NULL OR actual IS NULL OR
   (SELECT count(*) FROM jsonb_object_keys(piece))<>3 OR
   NOT COALESCE(piece->>'offset' ~ '^(0|[1-9][0-9]{0,4})$',false) OR
   NOT COALESCE(piece->>'quantity' ~ '^[1-9][0-9]{0,5}$',false) OR
   (piece->>'offset')::bigint<>prior_count OR piece->>'quantity' IS DISTINCT FROM actual->>'quantity' OR
   (piece->>'quantity')::bigint+prior_count>original_count
  THEN RAISE EXCEPTION 'Pickup unit positions must preserve actual physical history'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderPickupHandover_unit_ranges" BEFORE INSERT ON "OrderPickupHandover" FOR EACH ROW EXECUTE FUNCTION aat_validate_pickup_unit_ranges();
