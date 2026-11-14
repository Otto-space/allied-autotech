-- Preserve actual acknowledgement of the displayed, immutable alternative terms.
-- Earlier linked rows remain intact; absent evidence requires a revised offer.
CREATE FUNCTION aat_supply_alternative_acceptance_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE replacement "Order"%ROWTYPE; ack JSONB; terms JSONB;
BEGIN
 IF NEW."supplyRemedyChoiceId" IS NULL OR NEW."status"<>'ACCEPTED' OR OLD."status"='ACCEPTED' THEN RETURN NEW; END IF;
 SELECT * INTO replacement FROM "Order" WHERE "id"=NEW."orderId";
 ack:=replacement."policySnapshot"->'partsQuote'->'alternativeAcceptance';
 terms:=NEW."policySnapshot"->'supplyAlternative';
 IF ack IS NULL OR terms IS NULL OR ack->>'version' IS DISTINCT FROM 'SUPPLY_ALTERNATIVE_20261110_V1'
  OR terms->>'version' IS DISTINCT FROM ack->>'version'
  OR terms->>'monetaryHandling' IS DISTINCT FROM 'SEPARATE_ORIGINAL_REFUND_BEFORE_NEW_PAYMENT'
  OR terms->>'choiceId' IS DISTINCT FROM NEW."supplyRemedyChoiceId"::text
  OR ack->>'choiceId' IS DISTINCT FROM NEW."supplyRemedyChoiceId"::text
  OR replacement."policySnapshot"->'partsQuote'->'finance' IS DISTINCT FROM NEW."policySnapshot"
 THEN RAISE EXCEPTION 'Current explicit alternative acceptance proof is required'; END IF;
 IF replacement."customerId" IS NOT NULL THEN
  IF ack->>'guestSessionId' IS NOT NULL OR NOT EXISTS (
   SELECT 1 FROM "Session" s JOIN "User" u ON u."id"=s."userId" JOIN "CustomerProfile" c ON c."userId"=u."id"
   WHERE s."id"::text=ack->>'customerSessionId' AND c."id"=replacement."customerId"
    AND u."status"='ACTIVE' AND u."role"='CUSTOMER' AND u."emailVerifiedAt" IS NOT NULL
    AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()
    AND (NOT s."mfaRequired" OR s."mfaVerifiedAt" IS NOT NULL)
  ) THEN RAISE EXCEPTION 'Alternative acceptance needs the actual current customer session'; END IF;
 ELSE
  IF replacement."guestId" IS NULL OR ack->>'customerSessionId' IS NOT NULL OR NOT EXISTS (
   SELECT 1 FROM "PurchaseGuestSession" s WHERE s."id"::text=ack->>'guestSessionId' AND s."guestId"=replacement."guestId"
    AND s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp()
  ) THEN RAISE EXCEPTION 'Alternative acceptance needs the actual current guest session'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "PartsQuote_supply_acceptance_proof" BEFORE UPDATE OF "status" ON "PartsQuote" FOR EACH ROW EXECUTE FUNCTION aat_supply_alternative_acceptance_proof();
CREATE FUNCTION aat_preserve_supply_alternative_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."policySnapshot"->'partsQuote'->'alternativeAcceptance' IS NOT NULL AND
    OLD."policySnapshot"->'partsQuote'->'alternativeAcceptance' IS DISTINCT FROM NEW."policySnapshot"->'partsQuote'->'alternativeAcceptance'
 THEN RAISE EXCEPTION 'Recorded alternative acceptance proof is immutable'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Order_supply_alternative_acceptance" BEFORE UPDATE OF "policySnapshot" ON "Order" FOR EACH ROW EXECUTE FUNCTION aat_preserve_supply_alternative_acceptance();
CREATE FUNCTION aat_require_supply_alternative_refund_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM "OrderSupplyRemedyChoice" WHERE "id"=NEW."supplyRemedyChoiceId" AND "choice"='SUITABLE_ALTERNATIVE_REVIEW')
 AND NOT EXISTS (SELECT 1 FROM "PartsQuote" q JOIN "Order" replacement ON replacement."id"=q."orderId"
   WHERE q."supplyRemedyChoiceId"=NEW."supplyRemedyChoiceId" AND q."status"='ACCEPTED' AND replacement."status"<>'CANCELLED'
     AND q."policySnapshot"->'supplyAlternative'->>'version'='SUPPLY_ALTERNATIVE_20261110_V1'
     AND replacement."policySnapshot"->'partsQuote'->'alternativeAcceptance'->>'version'='SUPPLY_ALTERNATIVE_20261110_V1'
     AND replacement."policySnapshot"->'partsQuote'->'alternativeAcceptance'->>'choiceId'=NEW."supplyRemedyChoiceId"::text
 ) THEN RAISE EXCEPTION 'Verify actual alternative acknowledgement before requesting its original-portion refund'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Refund_supply_alternative_acceptance" BEFORE INSERT ON "Refund" FOR EACH ROW EXECUTE FUNCTION aat_require_supply_alternative_refund_acceptance();
