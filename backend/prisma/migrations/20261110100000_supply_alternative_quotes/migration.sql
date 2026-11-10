-- Additive actual-quotation linkage; never store credit or a money transfer.
ALTER TABLE "PartsQuote" ADD COLUMN "supplyRemedyChoiceId" UUID REFERENCES "OrderSupplyRemedyChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PartsQuote_supplyRemedyChoiceId_idx" ON "PartsQuote"("supplyRemedyChoiceId");
CREATE FUNCTION aat_guard_supply_alternative_quote() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE concern "OrderSupplyException"%ROWTYPE; choice "OrderSupplyRemedyChoice"%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."supplyRemedyChoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Alternative quotation linkage is retained'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND NEW."supplyRemedyChoiceId" IS DISTINCT FROM OLD."supplyRemedyChoiceId" THEN RAISE EXCEPTION 'Alternative quotation linkage is immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD."supplyRemedyChoiceId" IS NOT NULL AND (
  (to_jsonb(NEW)-ARRAY['status','orderId','decidedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','orderId','decidedAt'])
  OR OLD."status"<>'ISSUED' OR NEW."status" NOT IN ('ACCEPTED','REJECTED','VOID') OR NEW."decidedAt" IS NULL
  OR (NEW."status"<>'ACCEPTED' AND NEW."orderId" IS NOT NULL)
 ) THEN RAISE EXCEPTION 'Issued alternative price, product, terms and binding are immutable'; END IF;
 IF TG_OP='INSERT' AND NEW."supplyRemedyChoiceId" IS NOT NULL AND (NEW."status"<>'ISSUED' OR NEW."orderId" IS NOT NULL OR NEW."decidedAt" IS NOT NULL)
 THEN RAISE EXCEPTION 'An alternative must first be issued for explicit customer review'; END IF;
 IF TG_OP='UPDATE' AND NOT (NEW."status"='ACCEPTED' AND OLD."status" IS DISTINCT FROM NEW."status") THEN RETURN NEW; END IF;
 SELECT * INTO concern FROM "OrderSupplyException" WHERE "enquiryId"=NEW."enquiryId";
 IF concern."id" IS NULL THEN
  IF NEW."supplyRemedyChoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Use the actual original Care enquiry'; END IF;
  RETURN NEW;
 END IF;
 PERFORM 1 FROM "Order" WHERE "id"=concern."orderId" FOR UPDATE;
 SELECT * INTO choice FROM "OrderSupplyRemedyChoice" WHERE "id"=NEW."supplyRemedyChoiceId";
 IF choice."id" IS NULL OR choice."supplyExceptionId" IS DISTINCT FROM concern."id" OR choice."orderId" IS DISTINCT FROM concern."orderId"
  OR choice."choice"<>'SUITABLE_ALTERNATIVE_REVIEW' OR concern."kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE'
  OR EXISTS (SELECT 1 FROM "OrderSupplyRemedyChoice" WHERE "supplyExceptionId"=concern."id" AND "orderVersion">choice."orderVersion")
 THEN RAISE EXCEPTION 'An alternative quotation needs the actual current customer request'; END IF;
 IF NEW."status"='ACCEPTED' AND (NEW."orderId" IS NULL OR NOT EXISTS (
  SELECT 1 FROM "Order" replacement JOIN "Order" original ON original."id"=choice."orderId"
  WHERE replacement."id"=NEW."orderId" AND replacement."id"<>original."id"
    AND replacement."customerId" IS NOT DISTINCT FROM original."customerId"
    AND replacement."guestId" IS NOT DISTINCT FROM original."guestId"
    AND replacement."branchId" IS NOT DISTINCT FROM original."branchId"
    AND replacement."status"='PENDING' AND replacement."paidAt" IS NULL
    AND replacement."totalKobo"=NEW."totalKobo" AND replacement."taxKobo"=NEW."taxKobo" AND replacement."subtotalKobo"=NEW."subtotalKobo"
    AND replacement."currency"=NEW."currency" AND replacement."policySnapshot"->'partsQuote'->>'id'=NEW."id"::text
    AND (SELECT count(*) FROM "OrderItem" WHERE "orderId"=replacement."id")=1
    AND EXISTS (SELECT 1 FROM "OrderItem" WHERE "orderId"=replacement."id" AND "productId"=NEW."productId" AND "quantity"=NEW."quantity" AND "unitPriceKobo"=NEW."unitPriceKobo")
 )) THEN RAISE EXCEPTION 'Acceptance needs the same buyer actual unpaid replacement order'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "PartsQuote_supply_alternative_guard" BEFORE INSERT OR UPDATE OR DELETE ON "PartsQuote" FOR EACH ROW EXECUTE FUNCTION aat_guard_supply_alternative_quote();
CREATE FUNCTION aat_freeze_accepted_supply_alternative() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "PartsQuote" q JOIN "OrderSupplyRemedyChoice" c ON c."id"=q."supplyRemedyChoiceId" JOIN "Order" replacement ON replacement."id"=q."orderId"
   WHERE c."supplyExceptionId"=NEW."supplyExceptionId" AND q."status"='ACCEPTED' AND replacement."status"<>'CANCELLED')
 THEN RAISE EXCEPTION 'Reconcile the actual accepted alternative order before changing choice'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderSupplyRemedyChoice_alternative_guard" BEFORE INSERT ON "OrderSupplyRemedyChoice" FOR EACH ROW EXECUTE FUNCTION aat_freeze_accepted_supply_alternative();
-- Stop new preparation, never discard an actual successful late capture. Later
-- verified resolved-unit handling must refine this concern hold explicitly.
CREATE FUNCTION aat_hold_supply_alternative_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status" IN ('INITIALIZED','PENDING','PROCESSING') AND NEW."verificationStatus"='UNVERIFIED' AND EXISTS (
  SELECT 1 FROM "Payment" p JOIN "PartsQuote" q ON q."orderId"=p."orderId" JOIN "OrderSupplyRemedyChoice" c ON c."id"=q."supplyRemedyChoiceId" JOIN "OrderSupplyException" e ON e."id"=c."supplyExceptionId"
  WHERE p."id"=NEW."paymentId"
 ) THEN RAISE EXCEPTION 'Verify original affected goods financial resolution before preparing alternative payment'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "PaymentAttempt_supply_alternative_hold" BEFORE INSERT ON "PaymentAttempt" FOR EACH ROW EXECUTE FUNCTION aat_hold_supply_alternative_attempt();

-- Preserve original capture and monetary caps and independent approvals.
CREATE OR REPLACE FUNCTION aat_validate_supply_refund_link() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_id UUID; captured BIGINT; attempt_state TEXT; verified_state TEXT; choice "OrderSupplyRemedyChoice"%ROWTYPE; concern "OrderSupplyException"%ROWTYPE; scope_committed NUMERIC; attempt_committed NUMERIC; scope_total BIGINT;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD."supplyRemedyChoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Linked supply refund history is immutable'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW."supplyRemedyChoiceId" IS DISTINCT FROM OLD."supplyRemedyChoiceId" OR (OLD."supplyRemedyChoiceId" IS NOT NULL AND (NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo" OR NEW."paymentAttemptId" IS DISTINCT FROM OLD."paymentAttemptId")) THEN RAISE EXCEPTION 'Supply refund identity and amount are immutable'; END IF;
  RETURN NEW;
 END IF;
 SELECT p."orderId",a."amountKobo",a."status"::text,a."verificationStatus"::text INTO order_id,captured,attempt_state,verified_state FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE a."id"=NEW."paymentAttemptId";
 IF order_id IS NULL THEN
  IF NEW."supplyRemedyChoiceId" IS NOT NULL THEN RAISE EXCEPTION 'Supply refund needs the actual original order payment'; END IF;
  RETURN NEW;
 END IF;
 PERFORM 1 FROM "Order" WHERE "id"=order_id FOR UPDATE;
 IF NEW."supplyRemedyChoiceId" IS NULL THEN
  IF NEW."authorizationKind"<>'SYSTEM_LATE_ORDER' AND EXISTS (SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=order_id) THEN RAISE EXCEPTION 'Bind the affected supply remedy before a new refund'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO choice FROM "OrderSupplyRemedyChoice" WHERE "id"=NEW."supplyRemedyChoiceId";
 SELECT * INTO concern FROM "OrderSupplyException" WHERE "id"=choice."supplyExceptionId";
 IF choice."id" IS NULL OR choice."orderId" IS DISTINCT FROM order_id OR (choice."choice"<>'REFUND_REVIEW' AND NOT (choice."choice"='SUITABLE_ALTERNATIVE_REVIEW' AND EXISTS (SELECT 1 FROM "PartsQuote" q JOIN "Order" replacement ON replacement."id"=q."orderId" WHERE q."supplyRemedyChoiceId"=choice."id" AND q."status"='ACCEPTED' AND replacement."status"<>'CANCELLED')))
  OR concern."kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE' OR NEW."status"<>'REQUESTED' OR NEW."authorizationKind"<>'HUMAN'
  OR attempt_state<>'SUCCESSFUL' OR verified_state<>'VERIFIED' OR NEW."currency"<>'NGN'
  OR EXISTS (SELECT 1 FROM "OrderSupplyRemedyChoice" WHERE "supplyExceptionId"=choice."supplyExceptionId" AND "orderVersion">choice."orderVersion")
  OR concern."monetaryBasis"->>'status' IS DISTINCT FROM 'SAVED_ORDER_ALLOCATION'
  OR concern."monetaryBasis"->>'feeKobo' IS DISTINCT FROM '0'
  OR (concern."monetaryBasis"->'amounts'->>'totalKobo') IS NULL
  OR (concern."monetaryBasis"->'amounts'->>'totalKobo')!~'^[1-9][0-9]{0,18}$'
 THEN RAISE EXCEPTION 'Supply refund needs the current actual refund choice and reviewed original monetary basis'; END IF;
 IF EXISTS (SELECT 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=order_id AND r."supplyRemedyChoiceId" IS NULL AND r."status" NOT IN ('FAILED','CANCELLED')) THEN RAISE EXCEPTION 'Reconcile earlier unbound refunds before an affected-portion refund'; END IF;
 scope_total:=(concern."monetaryBasis"->'amounts'->>'totalKobo')::bigint;
 SELECT COALESCE(sum(r."amountKobo"),0) INTO scope_committed FROM "Refund" r JOIN "OrderSupplyRemedyChoice" c ON c."id"=r."supplyRemedyChoiceId" WHERE c."supplyExceptionId"=choice."supplyExceptionId" AND r."status" NOT IN ('FAILED','CANCELLED');
 SELECT COALESCE(sum("amountKobo"),0) INTO attempt_committed FROM "Refund" WHERE "paymentAttemptId"=NEW."paymentAttemptId" AND "status" NOT IN ('FAILED','CANCELLED');
 IF NEW."amountKobo"<=0 OR scope_committed+NEW."amountKobo">scope_total OR attempt_committed+NEW."amountKobo">captured THEN RAISE EXCEPTION 'Refund exceeds the affected original portion or actual captured amount'; END IF;
 RETURN NEW;
END; $$;
