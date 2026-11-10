CREATE TABLE "OrderPickupClaim" (
 "id" UUID NOT NULL PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "authorisationId" UUID NOT NULL UNIQUE REFERENCES "OrderPickupAuthorisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "performedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "selectedLines" JSONB NOT NULL CHECK (jsonb_typeof("selectedLines")='array' AND jsonb_array_length("selectedLines") BETWEEN 1 AND 200),
 "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "cancelledAt" TIMESTAMP(3), "cancelledByUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "cancellationReason" VARCHAR(1000), "consumedAt" TIMESTAMP(3),
 CHECK (num_nonnulls("cancelledAt","consumedAt")<=1),
 CHECK (COALESCE(("cancelledAt" IS NULL AND "cancelledByUserId" IS NULL AND "cancellationReason" IS NULL) OR ("cancelledAt">="claimedAt" AND "cancelledByUserId" IS NOT NULL AND length(trim("cancellationReason"))>=12),false)),
 CHECK ("consumedAt" IS NULL OR "consumedAt">="claimedAt")
);
CREATE INDEX "OrderPickupClaim_orderId_claimedAt_idx" ON "OrderPickupClaim"("orderId","claimedAt");
CREATE UNIQUE INDEX "OrderPickupClaim_one_active" ON "OrderPickupClaim"("orderId") WHERE "cancelledAt" IS NULL AND "consumedAt" IS NULL;
ALTER TABLE "OrderPickupHandover" ADD COLUMN "claimId" UUID REFERENCES "OrderPickupClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "OrderPickupHandover_claimId_key" ON "OrderPickupHandover"("claimId");
CREATE FUNCTION aat_preserve_pickup_claim() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; entitlement "OrderPickupAuthorisation"%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Pickup review history cannot be deleted'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF OLD."cancelledAt" IS NOT NULL OR OLD."consumedAt" IS NOT NULL
   OR (to_jsonb(OLD)-ARRAY['cancelledAt','cancelledByUserId','cancellationReason','consumedAt']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['cancelledAt','cancelledByUserId','cancellationReason','consumedAt'])
   OR num_nonnulls(NEW."cancelledAt",NEW."consumedAt")<>1 THEN RAISE EXCEPTION 'A pickup review may only be cancelled or completed once'; END IF;
  IF NEW."cancelledAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" WHERE "id"=NEW."cancelledByUserId" AND "status"='ACTIVE' AND ("role" IN ('ADMIN','SUPER_ADMIN') OR "id"=OLD."performedByUserId")) THEN RAISE EXCEPTION 'Only the current reviewer or administrator may release a pickup review'; END IF;
 ELSE
  SELECT * INTO entitlement FROM "OrderPickupAuthorisation" WHERE "id"=NEW."authorisationId" FOR SHARE;
  IF parent."id" IS NULL OR parent."status"<>'READY' OR parent."version"<>NEW."orderVersion" OR entitlement."orderId" IS DISTINCT FROM NEW."orderId" OR entitlement."revokedAt" IS NOT NULL OR entitlement."consumedAt" IS NOT NULL OR entitlement."expiresAt"<=clock_timestamp() OR NEW."cancelledAt" IS NOT NULL OR NEW."consumedAt" IS NOT NULL THEN RAISE EXCEPTION 'Claim the actual current ready order and an unused private authorisation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Session" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN "StaffProfile" p ON p."userId"=u."id"
   WHERE s."id"=NEW."sessionId" AND u."id"=NEW."performedByUserId" AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp() AND s."mfaVerifiedAt" IS NOT NULL AND (u."role" IN ('ADMIN','SUPER_ADMIN') OR (u."role"='STAFF' AND p."branchId"=parent."branchId"))) THEN RAISE EXCEPTION 'Pickup review needs current MFA and actual branch authority'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderPickupClaim_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderPickupClaim" FOR EACH ROW EXECUTE FUNCTION aat_preserve_pickup_claim();
CREATE FUNCTION aat_require_claimed_pickup() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='OrderPickupAuthorisation' THEN
  IF NEW."revokedAt" IS NOT NULL AND EXISTS (SELECT 1 FROM "OrderPickupClaim" WHERE "authorisationId"=NEW."id" AND "cancelledAt" IS NULL AND "consumedAt" IS NULL) THEN RAISE EXCEPTION 'Resolve the active physical pickup review before revocation'; END IF;
  IF NEW."consumedAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OrderPickupClaim" WHERE "authorisationId"=NEW."id" AND "cancelledAt" IS NULL AND "consumedAt"=NEW."consumedAt") THEN RAISE EXCEPTION 'Consume only the exclusive physical pickup review'; END IF;
 ELSE
  IF NEW."claimId" IS NULL OR NOT EXISTS (SELECT 1 FROM "OrderPickupClaim" c WHERE c."id"=NEW."claimId" AND c."orderId"=NEW."orderId" AND c."authorisationId"=NEW."authorisationId" AND c."performedByUserId"=NEW."performedByUserId" AND c."cancelledAt" IS NULL AND c."consumedAt"=NEW."createdAt" AND c."selectedLines"=NEW."lines") THEN RAISE EXCEPTION 'Handover must match the exclusive reviewed goods and operator'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderPickupAuthorisation_claim_guard" BEFORE UPDATE ON "OrderPickupAuthorisation" FOR EACH ROW EXECUTE FUNCTION aat_require_claimed_pickup();
CREATE TRIGGER "OrderPickupHandover_claim_guard" BEFORE INSERT ON "OrderPickupHandover" FOR EACH ROW EXECUTE FUNCTION aat_require_claimed_pickup();
CREATE FUNCTION aat_verify_pickup_claim_outcome() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."consumedAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OrderPickupHandover" WHERE "claimId"=NEW."id" AND "createdAt"=NEW."consumedAt") THEN RAISE EXCEPTION 'A consumed pickup review needs its immutable physical handover'; END IF;
 IF NEW."cancelledAt" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "OrderPickupAuthorisation" WHERE "id"=NEW."authorisationId" AND "revokedAt" IS NOT NULL) THEN RAISE EXCEPTION 'Cancel the unused pickup code with its review'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "OrderPickupClaim_outcome" AFTER UPDATE ON "OrderPickupClaim" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION aat_verify_pickup_claim_outcome();
