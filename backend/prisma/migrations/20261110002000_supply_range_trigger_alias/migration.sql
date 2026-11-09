-- Forward repair: avoid ambiguity with the implicit trigger OLD record.
CREATE OR REPLACE FUNCTION aat_preserve_order_supply_exception() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF EXISTS (SELECT 1 FROM "OrderSupplyException" e CROSS JOIN LATERAL jsonb_array_elements(e."affectedLines") AS existing_range(value) WHERE e."orderId"=NEW."orderId" AND existing_range.value->>'orderItemId'=line->>'orderItemId' AND (existing_range.value->>'offset')::integer<(line->>'offset')::integer+(line->>'quantity')::integer AND (line->>'offset')::integer<(existing_range.value->>'offset')::integer+(existing_range.value->>'quantity')::integer) THEN RAISE EXCEPTION 'These units already have an unresolved supply concern'; END IF;
 END LOOP;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW."affectedLines") WITH ORDINALITY a(line,n) CROSS JOIN jsonb_array_elements(NEW."affectedLines") WITH ORDINALITY b(line,n) WHERE a.n<b.n AND a.line->>'orderItemId'=b.line->>'orderItemId' AND (a.line->>'offset')::integer<(b.line->>'offset')::integer+(b.line->>'quantity')::integer AND (b.line->>'offset')::integer<(a.line->>'offset')::integer+(a.line->>'quantity')::integer) THEN RAISE EXCEPTION 'Supply unit ranges must not overlap'; END IF;
 RETURN NEW;
END; $$;
