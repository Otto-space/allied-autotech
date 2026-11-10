-- Additive binding to the existing independent refund kernel, never settlement.
ALTER TABLE "Refund" ADD COLUMN "supplyRemedyChoiceId" UUID REFERENCES "OrderSupplyRemedyChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Refund_supplyRemedyChoiceId_idx" ON "Refund"("supplyRemedyChoiceId");
CREATE FUNCTION aat_validate_supply_refund_link() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF choice."id" IS NULL OR choice."orderId" IS DISTINCT FROM order_id OR choice."choice"<>'REFUND_REVIEW'
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
CREATE TRIGGER "Refund_supply_link_guard" BEFORE INSERT OR UPDATE OR DELETE ON "Refund" FOR EACH ROW EXECUTE FUNCTION aat_validate_supply_refund_link();
CREATE FUNCTION aat_freeze_funded_supply_choice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF EXISTS (SELECT 1 FROM "Refund" r JOIN "OrderSupplyRemedyChoice" c ON c."id"=r."supplyRemedyChoiceId" WHERE c."supplyExceptionId"=NEW."supplyExceptionId" AND r."status" NOT IN ('FAILED','CANCELLED')) THEN RAISE EXCEPTION 'A refund is already committed to this choice; Customer Care must reconcile it before another choice'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderSupplyRemedyChoice_financial_guard" BEFORE INSERT ON "OrderSupplyRemedyChoice" FOR EACH ROW EXECUTE FUNCTION aat_freeze_funded_supply_choice();
