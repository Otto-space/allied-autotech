CREATE TABLE "OrderCollectionEvent" (
 "id" UUID PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "performedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0), "readyAt" TIMESTAMP(3) NOT NULL,
 "kind" VARCHAR(30) NOT NULL CHECK ("kind" IN ('NOTIFIED','NOTIFICATION_FAILED','EXTENDED')),
 "method" VARCHAR(20), "reason" VARCHAR(1000) NOT NULL CHECK (length(trim("reason"))>=12),
 "noticeId" UUID REFERENCES "OrderCollectionEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "previousCollectByDate" DATE, "collectByDate" DATE,
 "policySnapshot" JSONB NOT NULL, "idempotencyKey" UUID NOT NULL, "requestHash" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (COALESCE((("kind" IN ('NOTIFIED','NOTIFICATION_FAILED') AND "method" IN ('PHONE_CALL','IN_PERSON') AND "noticeId" IS NULL AND "previousCollectByDate" IS NULL AND "collectByDate" IS NULL) OR ("kind"='EXTENDED' AND "method" IS NULL AND "noticeId" IS NOT NULL AND "previousCollectByDate" IS NOT NULL AND "collectByDate">"previousCollectByDate")),false))
);
CREATE UNIQUE INDEX "OrderCollectionEvent_idempotencyKey_key" ON "OrderCollectionEvent"("idempotencyKey");
CREATE INDEX "OrderCollectionEvent_orderId_readyAt_kind_createdAt_idx" ON "OrderCollectionEvent"("orderId","readyAt","kind","createdAt");
CREATE FUNCTION aat_preserve_order_collection_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; notice "OrderCollectionEvent"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Collection contact and extension history is immutable'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF parent."status"<>'READY' OR parent."readyAt" IS DISTINCT FROM NEW."readyAt" OR parent."version"<>NEW."orderVersion" OR parent."fulfillmentMethod"<>'COLLECTION' OR NEW."createdAt"<NEW."readyAt" OR NEW."createdAt">clock_timestamp() THEN RAISE EXCEPTION 'Collection contact requires actual current ready goods'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "Session" s JOIN "User" u ON s."userId"=u."id" LEFT JOIN "StaffProfile" p ON p."userId"=u."id" WHERE s."id"=NEW."sessionId" AND u."id"=NEW."performedByUserId" AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND s."mfaVerifiedAt" IS NOT NULL AND (u."role" IN ('ADMIN','SUPER_ADMIN') OR (u."role"='STAFF' AND p."branchId"=parent."branchId"))) THEN RAISE EXCEPTION 'Collection contact needs actual current staff MFA and branch authority'; END IF;
 IF NEW."kind"='EXTENDED' THEN
  SELECT * INTO notice FROM "OrderCollectionEvent" WHERE "id"=NEW."noticeId";
  IF notice."id" IS NULL OR notice."kind"<>'NOTIFIED' OR notice."orderId"<>NEW."orderId" OR notice."readyAt"<>NEW."readyAt" THEN RAISE EXCEPTION 'Extension needs actual successful notification for the same ready order'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderCollectionEvent_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderCollectionEvent" FOR EACH ROW EXECUTE FUNCTION aat_preserve_order_collection_event();
