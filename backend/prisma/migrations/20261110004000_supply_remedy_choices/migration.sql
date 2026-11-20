-- Additive customer intent only. No refund, quote acceptance, stock or policy activation.
CREATE TABLE "OrderSupplyRemedyChoice" (
 "id" UUID PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "supplyExceptionId" UUID NOT NULL REFERENCES "OrderSupplyException"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "customerUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "guestSessionId" UUID REFERENCES "PurchaseGuestSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "choice" VARCHAR(48) NOT NULL CHECK ("choice" IN ('REFUND_REVIEW','SUITABLE_ALTERNATIVE_REVIEW','TECHNICAL_REVIEW')),
 "statementVersion" VARCHAR(48) NOT NULL CHECK ("statementVersion"='SUPPLY_CHOICE_20261110_V1'),
 "customerNote" VARCHAR(1000) NOT NULL,
 "idempotencyKey" UUID NOT NULL,
 "requestHash" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "OrderSupplyRemedyChoice_principal_check" CHECK (
  ("customerUserId" IS NOT NULL AND "sessionId" IS NOT NULL AND "guestSessionId" IS NULL)
  OR ("customerUserId" IS NULL AND "sessionId" IS NULL AND "guestSessionId" IS NOT NULL))
);
CREATE UNIQUE INDEX "OrderSupplyRemedyChoice_idempotencyKey_key" ON "OrderSupplyRemedyChoice"("idempotencyKey");
CREATE UNIQUE INDEX "OrderSupplyRemedyChoice_orderId_orderVersion_key" ON "OrderSupplyRemedyChoice"("orderId","orderVersion");
CREATE INDEX "OrderSupplyRemedyChoice_supplyExceptionId_orderVersion_idx" ON "OrderSupplyRemedyChoice"("supplyExceptionId","orderVersion");
CREATE FUNCTION aat_preserve_supply_remedy_choice() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; concern "OrderSupplyException"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Customer supply remedy choices are immutable; append a current choice'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 SELECT * INTO concern FROM "OrderSupplyException" WHERE "id"=NEW."supplyExceptionId";
 IF parent."id" IS NULL OR parent."version"<>NEW."orderVersion" OR concern."orderId" IS DISTINCT FROM NEW."orderId" THEN RAISE EXCEPTION 'Choose a current owned order supply concern'; END IF;
 IF (concern."kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE') IS DISTINCT FROM (NEW."choice"='TECHNICAL_REVIEW') THEN RAISE EXCEPTION 'Used, installed and disputed goods need technical assessment; this choice cannot approve a general return'; END IF;
 IF NEW."customerUserId" IS NOT NULL THEN
  IF parent."guestId" IS NOT NULL OR NOT EXISTS (
   SELECT 1 FROM "CustomerProfile" c JOIN "User" u ON u."id"=c."userId" JOIN "Session" s ON s."userId"=u."id"
   WHERE c."id"=parent."customerId" AND u."id"=NEW."customerUserId" AND u."role"='CUSTOMER'
    AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL AND s."id"=NEW."sessionId"
    AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()
  ) THEN RAISE EXCEPTION 'Only the current actual customer may choose the remedy'; END IF;
 ELSE
  IF parent."customerId" IS NOT NULL OR NOT EXISTS (
   SELECT 1 FROM "PurchaseGuestSession" s JOIN "PurchaseGuest" g ON g."id"=s."guestId"
   WHERE s."id"=NEW."guestSessionId" AND g."id"=parent."guestId" AND g."verifiedAt" IS NOT NULL
    AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()
  ) THEN RAISE EXCEPTION 'Only the current actual purchase guest may choose the remedy'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderSupplyRemedyChoice_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderSupplyRemedyChoice" FOR EACH ROW EXECUTE FUNCTION aat_preserve_supply_remedy_choice();
