-- Forward-only repair for actual customer cancellation refund recovery.
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
  IF NEW."authorizationKind"<>'SYSTEM_LATE_ORDER' AND EXISTS (SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=order_id) THEN
   -- Preserve actual whole-order customer cancellation recovery. This creates
   -- only a REQUESTED refund; separate approval/transfer/checking remain mandatory.
   SELECT COALESCE(sum("amountKobo"),0) INTO attempt_committed FROM "Refund" WHERE "paymentAttemptId"=NEW."paymentAttemptId" AND "status" NOT IN ('FAILED','CANCELLED');
   IF NOT COALESCE(NEW."authorizationKind"='HUMAN' AND NEW."status"='REQUESTED' AND NEW."currency"='NGN'
    AND NEW."approvedByUserId" IS NULL AND NEW."approvedAt" IS NULL AND NEW."processedAt" IS NULL
    AND attempt_state='SUCCESSFUL' AND verified_state='VERIFIED' AND NEW."amountKobo">0 AND NEW."amountKobo"=captured-attempt_committed
    AND NEW."policyVersionId" IS NOT NULL AND NEW."policySnapshot"->>'id'=NEW."policyVersionId"::text
    AND NEW."policySnapshot"->>'key'='cancellation' AND NEW."policySnapshot"->>'approvalStatus'='APPROVED'
    AND EXISTS(SELECT 1 FROM "Order" o JOIN "CustomerProfile" c ON c."id"=o."customerId" WHERE o."id"=order_id
     AND o."status"='CANCELLED' AND o."confirmedAt" IS NULL AND o."cancelledAt"<=clock_timestamp()
     AND o."fulfillmentMethod"='COLLECTION' AND o."currency"='NGN' AND c."userId"=NEW."requestedByUserId")
    AND EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."entityType"='ORDER' AND a."entityId"=order_id::text
     AND a."actorUserId"=NEW."requestedByUserId" AND a."newValues"->>'status'='CANCELLED')
    AND NOT EXISTS(SELECT 1 FROM "OrderPickupHandover" WHERE "orderId"=order_id)
    AND NOT EXISTS(SELECT 1 FROM "OrderPickupClaim" WHERE "orderId"=order_id AND "cancelledAt" IS NULL AND "consumedAt" IS NULL)
    AND NOT EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=order_id AND "kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE')
    AND NOT EXISTS(SELECT 1 FROM "PaymentDispute" WHERE "paymentAttemptId"=NEW."paymentAttemptId" AND "status"<>'WON'),false)
   THEN RAISE EXCEPTION 'Bind the affected supply remedy or review the actual full pre-confirmation customer cancellation'; END IF;
  END IF;
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
