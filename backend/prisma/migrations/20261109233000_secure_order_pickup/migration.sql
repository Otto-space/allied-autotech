CREATE TABLE "OrderPickupAuthorisation" (
 "id" UUID NOT NULL PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "issuedByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "issuedByGuestId" UUID REFERENCES "PurchaseGuest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "idempotencyKey" UUID NOT NULL UNIQUE,
 "requestHash" CHAR(64) NOT NULL CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
 "tokenHash" CHAR(64) NOT NULL UNIQUE CHECK ("tokenHash" ~ '^[0-9a-f]{64}$'),
 "lines" JSONB NOT NULL CHECK (jsonb_typeof("lines")='array' AND jsonb_array_length("lines") BETWEEN 1 AND 200),
 "securityPolicy" JSONB NOT NULL CHECK (jsonb_typeof("securityPolicy")='object'),
 "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 "revokedAt" TIMESTAMP(3), "consumedAt" TIMESTAMP(3),
 "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version">=0),
 CHECK (num_nonnulls("issuedByUserId","issuedByGuestId")=1),
 CHECK ("expiresAt">"issuedAt" AND "expiresAt"<="issuedAt"+interval '7 days'),
 CHECK ("revokedAt" IS NULL OR "revokedAt">="issuedAt"),
 CHECK ("consumedAt" IS NULL OR ("consumedAt">="issuedAt" AND "consumedAt"<"expiresAt")),
 CHECK (num_nonnulls("revokedAt","consumedAt")<=1)
);
CREATE INDEX "OrderPickupAuthorisation_orderId_issuedAt_idx" ON "OrderPickupAuthorisation"("orderId","issuedAt");
CREATE UNIQUE INDEX "OrderPickupAuthorisation_one_open" ON "OrderPickupAuthorisation"("orderId") WHERE "revokedAt" IS NULL AND "consumedAt" IS NULL;
CREATE TABLE "OrderPickupHandover" (
 "id" UUID NOT NULL PRIMARY KEY,
 "completedOrder" BOOLEAN NOT NULL DEFAULT false,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "authorisationId" UUID NOT NULL UNIQUE REFERENCES "OrderPickupAuthorisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "performedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "idempotencyKey" UUID NOT NULL UNIQUE,
 "requestHash" CHAR(64) NOT NULL CHECK ("requestHash" ~ '^[0-9a-f]{64}$'),
 "lines" JSONB NOT NULL CHECK (jsonb_typeof("lines")='array' AND jsonb_array_length("lines") BETWEEN 1 AND 200),
 "collectorName" VARCHAR(120) NOT NULL CHECK (length(trim("collectorName"))>0),
 "verificationNote" VARCHAR(1000) NOT NULL CHECK (length(trim("verificationNote"))>=12),
 "financialSnapshot" JSONB NOT NULL CHECK (jsonb_typeof("financialSnapshot")='object'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OrderPickupHandover_orderId_createdAt_idx" ON "OrderPickupHandover"("orderId","createdAt");
CREATE FUNCTION aat_preserve_order_pickup_authorisation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Pickup authorisation history cannot be deleted'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF NEW."consumedAt" IS NOT NULL AND OLD."expiresAt"<=clock_timestamp() THEN RAISE EXCEPTION 'Pickup authorisation has expired'; END IF;
  IF OLD."revokedAt" IS NOT NULL OR OLD."consumedAt" IS NOT NULL OR NEW."version"<>OLD."version"+1
   OR (to_jsonb(OLD)-ARRAY['version','revokedAt','consumedAt']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['version','revokedAt','consumedAt'])
   OR num_nonnulls(NEW."revokedAt",NEW."consumedAt")<>1 THEN
   RAISE EXCEPTION 'Pickup authorisation may only be revoked or consumed once'; END IF;
 ELSE
  IF parent."id" IS NULL OR parent."status"<>'READY' OR parent."paidAt" IS NULL OR parent."readyAt" IS NULL OR parent."version"<>NEW."orderVersion" OR NEW."version"<>0 OR NEW."revokedAt" IS NOT NULL OR NEW."consumedAt" IS NOT NULL THEN
   RAISE EXCEPTION 'Issue pickup authorisation only for a current paid ready order'; END IF;
  IF NOT COALESCE(((NEW."issuedByGuestId" IS NOT NULL AND NEW."issuedByGuestId"=parent."guestId" AND parent."customerId" IS NULL)
   OR (NEW."issuedByUserId" IS NOT NULL AND parent."guestId" IS NULL AND EXISTS (SELECT 1 FROM "CustomerProfile" WHERE "id"=parent."customerId" AND "userId"=NEW."issuedByUserId"))),false) THEN
   RAISE EXCEPTION 'Pickup authorisation belongs to the actual order buyer'; END IF;
  IF jsonb_array_length(NEW."lines")<>(SELECT count(DISTINCT line->>'orderItemId') FROM jsonb_array_elements(NEW."lines") line)
   OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW."lines") line LEFT JOIN "OrderItem" item ON item."id"=(line->>'orderItemId')::uuid
    WHERE item."id" IS NULL OR item."orderId"<>NEW."orderId" OR NOT COALESCE(line->>'quantity' ~ '^[1-9][0-9]{0,5}$',false) OR (line->>'quantity')::integer NOT BETWEEN 1 AND item."quantity") THEN
   RAISE EXCEPTION 'Pickup authorisation needs actual order items and quantities'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderPickupAuthorisation_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderPickupAuthorisation" FOR EACH ROW EXECUTE FUNCTION aat_preserve_order_pickup_authorisation();
CREATE FUNCTION aat_preserve_order_pickup_handover() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; entitlement "OrderPickupAuthorisation"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pickup handover history is append only'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 SELECT * INTO entitlement FROM "OrderPickupAuthorisation" WHERE "id"=NEW."authorisationId" FOR SHARE;
 IF parent."id" IS NULL OR parent."status"<>'READY' OR parent."readyAt" IS NULL OR parent."paidAt" IS NULL OR parent."version"<>NEW."orderVersion"
  OR entitlement."orderId"<>NEW."orderId" OR entitlement."consumedAt" IS DISTINCT FROM NEW."createdAt" OR entitlement."revokedAt" IS NOT NULL OR entitlement."expiresAt"<=clock_timestamp() THEN
  RAISE EXCEPTION 'Record a current ready order and consume its private authorisation before handover'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "User" u LEFT JOIN "StaffProfile" s ON s."userId"=u."id" WHERE u."id"=NEW."performedByUserId" AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL
  AND (u."role" IN ('ADMIN','SUPER_ADMIN') OR (u."role"='STAFF' AND s."branchId"=parent."branchId"))) THEN
  RAISE EXCEPTION 'Only the authorised active branch operator may record handover'; END IF;
 IF jsonb_array_length(NEW."lines")<>(SELECT count(DISTINCT line->>'orderItemId') FROM jsonb_array_elements(NEW."lines") line)
 OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(NEW."lines") line
  LEFT JOIN "OrderItem" item ON item."id"=(line->>'orderItemId')::uuid
  LEFT JOIN LATERAL (SELECT authorised FROM jsonb_array_elements(entitlement."lines") authorised WHERE authorised->>'orderItemId'=line->>'orderItemId') allowed ON true
  WHERE item."id" IS NULL OR item."orderId"<>NEW."orderId" OR allowed.authorised IS NULL OR NOT COALESCE(line->>'quantity' ~ '^[1-9][0-9]{0,5}$',false)
   OR (line->>'quantity')::integer NOT BETWEEN 1 AND (allowed.authorised->>'quantity')::integer
   OR (line->>'quantity')::integer+COALESCE((SELECT sum((prior->>'quantity')::integer) FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") prior WHERE h."orderId"=NEW."orderId" AND prior->>'orderItemId'=line->>'orderItemId'),0)>item."quantity"
 ) THEN RAISE EXCEPTION 'Pickup handover exceeds an authorised or remaining quantity'; END IF;
 IF NEW."completedOrder" IS DISTINCT FROM (NOT EXISTS (
  SELECT 1 FROM "OrderItem" item WHERE item."orderId"=NEW."orderId" AND item."quantity">COALESCE((SELECT sum((line->>'quantity')::integer) FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") line WHERE h."orderId"=NEW."orderId" AND line->>'orderItemId'=item."id"::text),0)+COALESCE((SELECT sum((line->>'quantity')::integer) FROM jsonb_array_elements(NEW."lines") line WHERE line->>'orderItemId'=item."id"::text),0)
 )) THEN RAISE EXCEPTION 'Pickup completion must match every actual remaining quantity'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderPickupHandover_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderPickupHandover" FOR EACH ROW EXECUTE FUNCTION aat_preserve_order_pickup_handover();

CREATE FUNCTION aat_require_order_pickup_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='COMPLETED' AND OLD."status"<>'COMPLETED' AND NEW."fulfillmentMethod"='COLLECTION' AND NOT EXISTS (
  SELECT 1 FROM "OrderPickupHandover" h WHERE h."orderId"=NEW."id" AND h."completedOrder" AND h."orderVersion"=OLD."version"
 ) THEN RAISE EXCEPTION 'Complete a collection order through verified private pickup handover'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Order_private_pickup_completion" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION aat_require_order_pickup_completion();
