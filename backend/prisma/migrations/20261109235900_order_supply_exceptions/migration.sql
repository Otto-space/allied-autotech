CREATE TABLE "OrderSupplyException" (
 "id" UUID PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "enquiryId" UUID NOT NULL REFERENCES "Enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sourceTimingUpdateId" UUID REFERENCES "OrderTimingUpdate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "raisedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "kind" VARCHAR(48) NOT NULL CHECK ("kind" IN ('UNAVAILABLE','WRONG_OR_UNSUITABLE_SUPPLY','USED_INSTALLED_OR_DIAGNOSIS_DISPUTE')),
 "affectedLines" JSONB NOT NULL CHECK (jsonb_typeof("affectedLines")='array' AND jsonb_array_length("affectedLines") BETWEEN 1 AND 200),
 "monetaryBasis" JSONB NOT NULL,
 "customerNote" VARCHAR(1000) NOT NULL CHECK (length(trim("customerNote"))>=12),
 "reason" VARCHAR(1000) NOT NULL CHECK (length(trim("reason"))>=12),
 "idempotencyKey" UUID NOT NULL, "requestHash" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OrderSupplyException_enquiryId_key" ON "OrderSupplyException"("enquiryId");
CREATE UNIQUE INDEX "OrderSupplyException_sourceTimingUpdateId_key" ON "OrderSupplyException"("sourceTimingUpdateId");
CREATE UNIQUE INDEX "OrderSupplyException_idempotencyKey_key" ON "OrderSupplyException"("idempotencyKey");
CREATE INDEX "OrderSupplyException_orderId_createdAt_idx" ON "OrderSupplyException"("orderId","createdAt");
CREATE FUNCTION aat_preserve_order_supply_exception() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; support "Enquiry"%ROWTYPE; line JSONB;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Supply concern facts and saved money basis are immutable'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF parent."id" IS NULL OR parent."version"<>NEW."orderVersion" OR parent."status"='CANCELLED' THEN RAISE EXCEPTION 'Supply concern must match the current actual order'; END IF;
 SELECT * INTO support FROM "Enquiry" WHERE "id"=NEW."enquiryId";
 IF support."id" IS NULL OR support."branchId" IS DISTINCT FROM parent."branchId" OR support."customerId" IS DISTINCT FROM parent."customerId" OR support."email" IS DISTINCT FROM parent."customerEmail" THEN RAISE EXCEPTION 'Supply concern needs the actual customer and branch support case'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Session" s JOIN "User" u ON u."id"=s."userId" WHERE s."id"=NEW."sessionId" AND u."id"=NEW."raisedByUserId" AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL AND u."role" IN ('ADMIN','SUPER_ADMIN') AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND s."mfaVerifiedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Supply concern authoring needs a current verified administrator'; END IF;
 IF NEW."sourceTimingUpdateId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OrderTimingUpdate" WHERE "id"=NEW."sourceTimingUpdateId" AND "orderId"=NEW."orderId" AND "orderVersion"=NEW."orderVersion") THEN RAISE EXCEPTION 'Supply concern must retain its actual sourcing update'; END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(NEW."affectedLines") LOOP
  IF jsonb_typeof(line)<>'object' OR (line->>'offset')!~'^(0|[1-9][0-9]{0,4})$' OR (line->>'quantity')!~'^[1-9][0-9]{0,5}$' OR NOT EXISTS (SELECT 1 FROM "OrderItem" WHERE "id"=(line->>'orderItemId')::uuid AND "orderId"=NEW."orderId" AND (line->>'quantity')::integer BETWEEN 1 AND 100000 AND (line->>'offset')::integer+(line->>'quantity')::integer<="quantity") THEN RAISE EXCEPTION 'Choose actual bounded order quantities'; END IF;
  IF EXISTS (SELECT 1 FROM "OrderSupplyException" e CROSS JOIN LATERAL jsonb_array_elements(e."affectedLines") old WHERE e."orderId"=NEW."orderId" AND old->>'orderItemId'=line->>'orderItemId' AND (old->>'offset')::integer<(line->>'offset')::integer+(line->>'quantity')::integer AND (line->>'offset')::integer<(old->>'offset')::integer+(old->>'quantity')::integer) THEN RAISE EXCEPTION 'These units already have an unresolved supply concern'; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW."affectedLines") WITH ORDINALITY a(line,n) CROSS JOIN jsonb_array_elements(NEW."affectedLines") WITH ORDINALITY b(line,n) WHERE a.n<b.n AND a.line->>'orderItemId'=b.line->>'orderItemId' AND (a.line->>'offset')::integer<(b.line->>'offset')::integer+(b.line->>'quantity')::integer AND (b.line->>'offset')::integer<(a.line->>'offset')::integer+(a.line->>'quantity')::integer) THEN RAISE EXCEPTION 'Supply unit ranges must not overlap'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderSupplyException_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderSupplyException" FOR EACH ROW EXECUTE FUNCTION aat_preserve_order_supply_exception();
