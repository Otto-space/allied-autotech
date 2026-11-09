CREATE TABLE "OrderTimingUpdate" (
 "id" UUID NOT NULL PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "performedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "idempotencyKey" UUID NOT NULL UNIQUE,
 "requestHash" CHAR(64) NOT NULL CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
 "lines" JSONB NOT NULL CHECK (jsonb_typeof("lines")='array' AND jsonb_array_length("lines") BETWEEN 1 AND 200),
 "customerNote" VARCHAR(1000) NOT NULL CHECK (length(trim("customerNote"))>0),
 "reason" VARCHAR(1000) NOT NULL CHECK (length(trim("reason"))>0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("orderId","orderVersion")
);
CREATE INDEX "OrderTimingUpdate_orderId_createdAt_idx" ON "OrderTimingUpdate"("orderId","createdAt");
CREATE FUNCTION aat_preserve_order_timing_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Order timing history is append only'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF parent."id" IS NULL OR parent."version"<>NEW."orderVersion" OR parent."status" IN ('READY','COMPLETED','CANCELLED') THEN
  RAISE EXCEPTION 'Review an open, not-ready order before updating estimates'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "User" WHERE "id"=NEW."performedByUserId" AND "role" IN ('ADMIN','SUPER_ADMIN') AND "status"='ACTIVE' AND "emailVerifiedAt" IS NOT NULL) THEN
  RAISE EXCEPTION 'An authorised administrator must record estimates'; END IF;
 IF jsonb_array_length(NEW."lines")<>(SELECT count(*) FROM "OrderItem" WHERE "orderId"=NEW."orderId")
 OR jsonb_array_length(NEW."lines")<>(SELECT count(DISTINCT line->>'orderItemId') FROM jsonb_array_elements(NEW."lines") line)
 OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW."lines") line LEFT JOIN "OrderItem" item ON item."id"=(line->>'orderItemId')::uuid
  WHERE item."id" IS NULL OR item."orderId"<>NEW."orderId" OR NOT COALESCE(line->>'sourcingStatus' IN ('UNKNOWN','IN_STOCK','SUPPLIER_CONFIRMED','ORDERED','IN_TRANSIT','ARRIVED','UNAVAILABLE'),false)) THEN
  RAISE EXCEPTION 'Estimates must identify every actual order item once'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderTimingUpdate_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderTimingUpdate"
 FOR EACH ROW EXECUTE FUNCTION aat_preserve_order_timing_update();
