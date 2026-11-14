-- Forward-only recovery for actual pre-confirmation buyer cancellations.
-- A basis permits a human REQUEST, not approval, transfer, payment or stock action.
CREATE FUNCTION aat_preconfirmation_supply_cancellation_basis(parent_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; policy "BusinessPolicyVersion"%ROWTYPE; audit_id UUID; access_kind TEXT;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id"=parent_id FOR UPDATE SKIP LOCKED;
 IF parent."id" IS NULL OR parent."status"<>'CANCELLED' OR parent."confirmedAt" IS NOT NULL
  OR parent."cancelledAt" IS NULL OR parent."cancelledAt">clock_timestamp()
  OR parent."fulfillmentMethod"<>'COLLECTION' OR parent."currency"<>'NGN'
  OR NOT EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=parent_id)
  OR EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=parent_id AND "kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE')
  OR EXISTS(SELECT 1 FROM "OrderPickupHandover" WHERE "orderId"=parent_id)
  OR EXISTS(SELECT 1 FROM "OrderPickupClaim" WHERE "orderId"=parent_id AND "cancelledAt" IS NULL AND "consumedAt" IS NULL)
  OR EXISTS(SELECT 1 FROM "InventoryReservation" WHERE "referenceType"='ORDER' AND "referenceId"=parent_id::text AND "status"='ACTIVE')
 THEN RETURN NULL; END IF;
 SELECT * INTO policy FROM "BusinessPolicyVersion" WHERE "key"='cancellation' AND "effectiveAt"<=clock_timestamp()
  ORDER BY "effectiveAt" DESC,"version" DESC LIMIT 1;
 IF policy."id" IS NULL OR policy."approvalStatus" NOT IN ('PENDING','APPROVED')
  OR policy."settings"->>'beforeConfirmationFeeKobo' IS DISTINCT FROM '0' THEN RETURN NULL; END IF;
 SELECT a."id",CASE WHEN parent."guestId" IS NOT NULL THEN 'EMAIL_VERIFIED_GUEST' ELSE 'ACCOUNT' END INTO audit_id,access_kind
 FROM "AuditLog" a WHERE a."entityType"='ORDER' AND a."entityId"=parent_id::text AND a."action"='STATUS_CHANGE'
  AND a."oldValues"->>'status'='PENDING' AND a."newValues"->>'status'='CANCELLED'
  AND a."newValues"->>'reason'=parent."cancellationReason" AND a."createdAt"<=clock_timestamp()
  AND ((parent."guestId" IS NOT NULL AND parent."customerId" IS NULL AND a."userId" IS NULL
    AND a."newValues"->>'guestId'=parent."guestId"::text AND a."newValues"->>'purchaseAccess'='EMAIL_VERIFIED_GUEST'
    AND EXISTS(SELECT 1 FROM "PurchaseGuest" WHERE "id"=parent."guestId"))
   OR (parent."guestId" IS NULL AND parent."customerId" IS NOT NULL
    AND EXISTS(SELECT 1 FROM "CustomerProfile" c WHERE c."id"=parent."customerId" AND c."userId"=a."userId")))
 ORDER BY a."createdAt" DESC,a."id" DESC LIMIT 1;
 IF audit_id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('version','PRECONFIRMATION_SUPPLY_CANCELLATION_V1','orderId',parent_id,
  'cancellationAuditId',audit_id,'purchaseAccess',access_kind,'cancellationPolicy',jsonb_build_object(
   'id',policy."id",'key',policy."key",'version',policy."version",'approvalStatus',policy."approvalStatus",
   'source',policy."source",'effectiveAt',policy."effectiveAt",'settings',policy."settings"));
END; $$;

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
   IF NOT COALESCE((NEW."authorizationKind"='HUMAN' AND NEW."status"='REQUESTED' AND NEW."currency"='NGN'
    AND NEW."approvedByUserId" IS NULL AND NEW."approvedAt" IS NULL AND NEW."processedAt" IS NULL
    AND attempt_state='SUCCESSFUL' AND verified_state='VERIFIED' AND NEW."amountKobo">0 AND NEW."amountKobo"=captured-attempt_committed
    AND NEW."policyVersionId" IS NOT NULL AND NEW."policySnapshot"->>'id'=NEW."policyVersionId"::text
    AND NEW."policySnapshot"->>'key'='cancellation'
    AND EXISTS(SELECT 1 FROM "BusinessPolicyVersion" v WHERE v."id"=NEW."policyVersionId" AND v."key"='cancellation'
     AND v."settings"->>'beforeConfirmationFeeKobo'='0'
     AND NEW."policySnapshot"->'settings'=v."settings"
     AND NEW."policySnapshot"->>'approvalStatus'=v."approvalStatus"::text)
    AND EXISTS(SELECT 1 FROM "Order" o JOIN "CustomerProfile" c ON c."id"=o."customerId" WHERE o."id"=order_id
     AND o."status"='CANCELLED' AND o."confirmedAt" IS NULL AND o."cancelledAt"<=clock_timestamp()
     AND o."fulfillmentMethod"='COLLECTION' AND o."currency"='NGN' AND c."userId"=NEW."requestedByUserId")
    AND EXISTS(SELECT 1 FROM "AuditLog" a WHERE a."entityType"='ORDER' AND a."entityId"=order_id::text
     AND a."userId"=NEW."requestedByUserId" AND a."newValues"->>'status'='CANCELLED')
    AND NOT EXISTS(SELECT 1 FROM "OrderPickupHandover" WHERE "orderId"=order_id)
    AND NOT EXISTS(SELECT 1 FROM "OrderPickupClaim" WHERE "orderId"=order_id AND "cancelledAt" IS NULL AND "consumedAt" IS NULL)
    AND NOT EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=order_id AND "kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE')
    AND NOT EXISTS(SELECT 1 FROM "PaymentDispute" WHERE "paymentAttemptId"=NEW."paymentAttemptId" AND "status"<>'WON')) OR (NEW."authorizationKind"='HUMAN' AND NEW."status"='REQUESTED' AND NEW."currency"='NGN'
    AND NEW."approvedByUserId" IS NULL AND NEW."approvedAt" IS NULL AND NEW."processedAt" IS NULL
    AND attempt_state='SUCCESSFUL' AND verified_state='VERIFIED' AND NEW."amountKobo">0 AND NEW."amountKobo"=captured-attempt_committed
    AND EXISTS(SELECT 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" JOIN "Order" o ON o."id"=p."orderId"
      WHERE a."id"=NEW."paymentAttemptId" AND a."verifiedAmountKobo"=a."amountKobo" AND a."verifiedCurrency"='NGN'
       AND a."paidAt"<=clock_timestamp() AND a."verifiedAt"<=clock_timestamp()
       AND p."purpose"='ORDER_PAYMENT' AND p."status"='SUCCEEDED' AND p."settledAttemptId" IS NOT NULL
       AND p."amountKobo"=a."amountKobo" AND p."currency"='NGN' AND p."invoiceId" IS NULL AND p."bookingId" IS NULL AND p."vehicleTransactionId" IS NULL
       AND p."customerId" IS NOT DISTINCT FROM o."customerId" AND p."guestId" IS NOT DISTINCT FROM o."guestId"
       AND EXISTS(SELECT 1 FROM "PaymentLedgerEntry" l WHERE l."paymentAttemptId"=a."id" AND l."sourceKey"='capture:'||a."id"::text
        AND l."type"='CAPTURE' AND l."direction"='CREDIT' AND l."currency"='NGN' AND l."amountKobo"=a."amountKobo" AND l."occurredAt"=a."paidAt"
        AND l."refundId" IS NULL AND l."disputeId" IS NULL)
       AND (a."provider"<>'MANUAL' OR EXISTS(SELECT 1 FROM "ManualPaymentReview" m WHERE m."paymentAttemptId"=a."id" AND m."status"='APPROVED'
        AND m."reviewedByUserId" IS NOT NULL AND (m."submittedByUserId" IS NULL OR m."submittedByUserId"<>m."reviewedByUserId")
        AND m."reviewedAt">=a."paidAt" AND m."reviewedAt"<=clock_timestamp())))
    AND NEW."policySnapshot"->'preConfirmationCancellation' IS NOT NULL
    AND NEW."policySnapshot"->'preConfirmationCancellation'=aat_preconfirmation_supply_cancellation_basis(order_id)
    AND NEW."policySnapshot"->>'id'=NEW."policyVersionId"::text AND NEW."policySnapshot"->>'key'='manual-refund'
    AND NEW."policySnapshot"->>'approvalStatus'='APPROVED'
    AND EXISTS(SELECT 1 FROM "BusinessPolicyVersion" v WHERE v."id"=NEW."policyVersionId" AND v."key"='manual-refund'
      AND v."approvalStatus"='APPROVED' AND NEW."policySnapshot"->'settings'=v."settings")
    AND EXISTS(SELECT 1 FROM "User" u JOIN "Session" s ON s."userId"=u."id" WHERE u."id"=NEW."requestedByUserId"
      AND u."role" IN ('ADMIN','SUPER_ADMIN') AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL
      AND s."revokedAt" IS NULL AND s."mfaVerifiedAt" IS NOT NULL AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp())
    AND NOT EXISTS(SELECT 1 FROM "PaymentDispute" WHERE "paymentAttemptId"=NEW."paymentAttemptId" AND "status"<>'WON')
    AND NOT EXISTS(SELECT 1 FROM "PaymentAnomaly" WHERE "status" IN ('OPEN','INVESTIGATING')
      AND ("paymentAttemptId"=NEW."paymentAttemptId" OR "paymentId" IN(SELECT "paymentId" FROM "PaymentAttempt" WHERE "id"=NEW."paymentAttemptId")))),false)
   THEN RAISE EXCEPTION 'Bind the affected supply remedy or review the actual full pre-confirmation buyer cancellation'; END IF;
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
