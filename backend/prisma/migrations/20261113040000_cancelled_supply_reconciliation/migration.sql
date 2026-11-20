-- Forward-only cancelled-order reconciliation; never invents a refund, allocation,
-- handover or stock return. Existing V1 closure snapshots remain valid unchanged.
CREATE FUNCTION aat_cancelled_supply_snapshot(parent_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; attempt "PaymentAttempt"%ROWTYPE; refund "Refund"%ROWTYPE;
 gross NUMERIC:=0; returned NUMERIC:=0; original_units BIGINT;
 captures JSONB:='[]'::jsonb; refunds JSONB:='[]'::jsonb; concerns JSONB; choices JSONB;
 capture_id UUID; refund_ledger UUID; locked_count BIGINT;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id"=parent_id FOR UPDATE SKIP LOCKED;
 IF parent."id" IS NULL OR parent."status"<>'CANCELLED' OR parent."cancelledAt" IS NULL
  OR parent."cancelledAt">clock_timestamp() OR parent."currency"<>'NGN' OR parent."totalKobo"<=0
  OR parent."fulfillmentMethod"<>'COLLECTION'
  OR NOT EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=parent_id)
  OR EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=parent_id AND "kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE')
  OR EXISTS(SELECT 1 FROM "OrderPickupHandover" WHERE "orderId"=parent_id)
  OR EXISTS(SELECT 1 FROM "OrderPickupClaim" WHERE "orderId"=parent_id AND "cancelledAt" IS NULL AND "consumedAt" IS NULL)
  OR EXISTS(SELECT 1 FROM "InventoryReservation" WHERE "referenceType"='ORDER' AND "referenceId"=parent_id::text AND "status"='ACTIVE')
 THEN RAISE EXCEPTION 'Review actual cancellation, goods, pickup and released allocations before reconciliation'; END IF;
 SELECT sum("quantity") INTO original_units FROM "OrderItem" WHERE "orderId"=parent_id;
 IF original_units IS NULL OR original_units<=0 THEN RAISE EXCEPTION 'Actual original goods are required'; END IF;
 -- Lock every intent and attempt; unknown or busy money must not disappear.
 PERFORM 1 FROM "Payment" WHERE "orderId"=parent_id ORDER BY "id" FOR SHARE SKIP LOCKED;
 GET DIAGNOSTICS locked_count=ROW_COUNT;
 IF locked_count<>(SELECT count(*) FROM "Payment" WHERE "orderId"=parent_id)
  OR EXISTS(SELECT 1 FROM "Payment" WHERE "orderId"=parent_id AND
   ("currency"<>'NGN' OR "amountKobo"<=0 OR "invoiceId" IS NOT NULL OR "bookingId" IS NOT NULL OR "vehicleTransactionId" IS NOT NULL
    OR "status" NOT IN ('CANCELLED','EXPIRED','SUCCEEDED')))
 THEN RAISE EXCEPTION 'Reconcile busy, pending or unrelated payment evidence first'; END IF;
 PERFORM 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id ORDER BY a."id" FOR SHARE OF a SKIP LOCKED;
 GET DIAGNOSTICS locked_count=ROW_COUNT;
 IF locked_count<>(SELECT count(*) FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id)
  OR locked_count>1000
  OR EXISTS(SELECT 1 FROM "PaymentAnomaly" n WHERE n."status" IN ('OPEN','INVESTIGATING') AND
   (n."paymentId" IN(SELECT "id" FROM "Payment" WHERE "orderId"=parent_id)
    OR n."paymentAttemptId" IN(SELECT a."id" FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id)
    OR n."refundId" IN(SELECT r."id" FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id)))
  OR EXISTS(SELECT 1 FROM "PaymentDispute" d JOIN "PaymentAttempt" a ON a."id"=d."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id AND d."status"<>'WON')
 THEN RAISE EXCEPTION 'Reconcile busy payment, anomaly and dispute evidence first'; END IF;
 FOR attempt IN SELECT a.* FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id ORDER BY a."id" LOOP
  -- Failed/abandoned/unverified status alone is not authoritative proof that no
  -- money arrived. Reversal observations also stay in existing financial review.
  IF attempt."status"<>'SUCCESSFUL' OR attempt."verificationStatus"<>'VERIFIED'
   OR attempt."currency"<>'NGN' OR attempt."verifiedCurrency" IS DISTINCT FROM 'NGN'
   OR attempt."verifiedAmountKobo" IS DISTINCT FROM attempt."amountKobo" OR attempt."amountKobo"<=0
   OR attempt."paidAt" IS NULL OR attempt."verifiedAt" IS NULL OR attempt."paidAt">clock_timestamp() OR attempt."verifiedAt">clock_timestamp()
   OR NOT EXISTS(SELECT 1 FROM "Payment" p WHERE p."id"=attempt."paymentId" AND p."amountKobo"=attempt."amountKobo" AND p."status"='SUCCEEDED'
    AND p."settledAttemptId" IS NOT NULL AND p."succeededAt"<=clock_timestamp())
   OR EXISTS(SELECT 1 FROM "ManualPaymentReview" WHERE "paymentAttemptId"=attempt."id" AND "status"<>'APPROVED')
  THEN RAISE EXCEPTION 'Every recorded payment attempt needs actual independently verified capture and return'; END IF;
  SELECT l."id" INTO capture_id FROM "PaymentLedgerEntry" l WHERE l."paymentAttemptId"=attempt."id" AND l."sourceKey"='capture:'||attempt."id"::text
   AND l."type"='CAPTURE' AND l."direction"='CREDIT' AND l."currency"='NGN' AND l."amountKobo"=attempt."amountKobo"
   AND l."refundId" IS NULL AND l."disputeId" IS NULL AND l."occurredAt"=attempt."paidAt" AND l."occurredAt"<=clock_timestamp();
  IF capture_id IS NULL OR EXISTS(SELECT 1 FROM "PaymentLedgerEntry" l WHERE l."paymentAttemptId"=attempt."id" AND l."refundId" IS NULL AND l."id"<>capture_id)
  THEN RAISE EXCEPTION 'Exact canonical capture credit is required'; END IF;
  PERFORM 1 FROM "Refund" WHERE "paymentAttemptId"=attempt."id" ORDER BY "id" FOR SHARE SKIP LOCKED;
  GET DIAGNOSTICS locked_count=ROW_COUNT;
  IF locked_count<>(SELECT count(*) FROM "Refund" WHERE "paymentAttemptId"=attempt."id") OR locked_count>1000
  THEN RAISE EXCEPTION 'Refund evidence is busy or exceeds the supported review bound'; END IF;
  returned:=0;
  FOR refund IN SELECT * FROM "Refund" WHERE "paymentAttemptId"=attempt."id" ORDER BY "id" LOOP
   IF refund."status" IN ('FAILED','CANCELLED') THEN
    IF EXISTS(SELECT 1 FROM "PaymentLedgerEntry" WHERE "refundId"=refund."id") THEN RAISE EXCEPTION 'Reconcile contradictory failed refund money'; END IF;
    CONTINUE;
   END IF;
   IF refund."status"<>'SUCCEEDED' OR refund."currency"<>'NGN' OR refund."amountKobo"<=0
    OR refund."approvedAt" IS NULL OR refund."processedAt" IS NULL OR refund."processedAt"<refund."approvedAt" OR refund."approvedAt"<attempt."paidAt" OR refund."processedAt">clock_timestamp()
    OR NOT COALESCE((refund."authorizationKind"='HUMAN' AND refund."requestedByUserId" IS NOT NULL AND refund."approvedByUserId" IS NOT NULL AND refund."requestedByUserId"<>refund."approvedByUserId")
     OR (refund."authorizationKind"='SYSTEM_LATE_ORDER' AND attempt."provider"='PAYSTACK' AND refund."policyVersionId" IS NOT NULL
      AND refund."policySnapshot"->>'id'=refund."policyVersionId"::text AND refund."policySnapshot"->>'key'='order-payment' AND refund."policySnapshot"->>'approvalStatus'='APPROVED'),false)
   THEN RAISE EXCEPTION 'Actual independently authorised and settled refunds are required'; END IF;
   IF attempt."provider"='MANUAL' THEN
    IF NOT COALESCE(refund."authorizationKind"='HUMAN' AND refund."providerStatus"='BANK_TRANSFER_CHECKED'
     AND refund."transferredByUserId"<>refund."requestedByUserId" AND refund."transferredByUserId"<>refund."approvedByUserId"
     AND refund."checkedByUserId"<>refund."requestedByUserId" AND refund."checkedByUserId"<>refund."approvedByUserId" AND refund."checkedByUserId"<>refund."transferredByUserId"
     AND refund."bankTransferAt">=refund."approvedAt" AND refund."transferRecordedAt">=refund."bankTransferAt" AND refund."checkedAt">=refund."transferRecordedAt" AND refund."processedAt">=refund."checkedAt"
     AND length(btrim(refund."bankReference"))>0 AND length(refund."evidenceObjectKey")>0 AND refund."evidenceSha256"~'^[a-f0-9]{64}$'
     AND refund."beneficiaryEncrypted" IS NOT NULL AND refund."beneficiaryEncrypted"<>'null'::jsonb,false)
    THEN RAISE EXCEPTION 'Separate actual bank transfer and independent checking evidence are required'; END IF;
   ELSIF COALESCE(length(btrim(refund."providerRefundId")),0)=0 THEN RAISE EXCEPTION 'Verified provider refund identity is required'; END IF;
   SELECT l."id" INTO refund_ledger FROM "PaymentLedgerEntry" l WHERE l."refundId"=refund."id" AND l."sourceKey"='refund:'||refund."id"::text
    AND l."type"='REFUND' AND l."direction"='DEBIT' AND l."amountKobo"=refund."amountKobo" AND l."currency"='NGN' AND l."disputeId" IS NULL
    AND (l."paymentAttemptId" IS NULL OR l."paymentAttemptId"=attempt."id") AND l."occurredAt">=refund."approvedAt" AND l."occurredAt"<=clock_timestamp();
   IF refund_ledger IS NULL OR (SELECT count(*) FROM "PaymentLedgerEntry" WHERE "refundId"=refund."id")<>1
   THEN RAISE EXCEPTION 'Exact canonical settled refund debit is required'; END IF;
   returned:=returned+refund."amountKobo";
   refunds:=refunds||jsonb_build_array(jsonb_build_object('refundId',refund."id",'paymentAttemptId',attempt."id",'ledgerEntryId',refund_ledger,'amountKobo',refund."amountKobo"::text));
  END LOOP;
  IF returned<>attempt."amountKobo" THEN RAISE EXCEPTION 'Every actual capture must be returned in full; no credit or deduction is inferred'; END IF;
  gross:=gross+attempt."amountKobo";
  captures:=captures||jsonb_build_array(jsonb_build_object('paymentId',attempt."paymentId",'paymentAttemptId',attempt."id",'ledgerEntryId',capture_id,'amountKobo',attempt."amountKobo"::text));
 END LOOP;
 IF EXISTS(SELECT 1 FROM "Payment" p WHERE p."orderId"=parent_id AND
  ((p."status"='SUCCEEDED' AND NOT EXISTS(SELECT 1 FROM "PaymentAttempt" a WHERE a."id"=p."settledAttemptId" AND a."paymentId"=p."id" AND a."status"='SUCCESSFUL'))
   OR (NOT EXISTS(SELECT 1 FROM "PaymentAttempt" WHERE "paymentId"=p."id") AND
    (p."settledAttemptId" IS NOT NULL OR p."succeededAt" IS NOT NULL OR NOT COALESCE(
      (p."status"='CANCELLED' AND p."cancelledAt"<=clock_timestamp()) OR (p."status"='EXPIRED' AND p."expiredAt"<=clock_timestamp()),false)))))
  OR (gross=0 AND (parent."paidAt" IS NOT NULL OR EXISTS(SELECT 1 FROM "InventoryReservation" WHERE "referenceType"='ORDER' AND "referenceId"=parent_id::text AND "status"='CONSUMED')))
 THEN RAISE EXCEPTION 'Uncaptured reconciliation needs actual closed untouched payment intents and no consumed goods'; END IF;
 SELECT jsonb_agg("id"::text ORDER BY "id") INTO concerns FROM "OrderSupplyException" WHERE "orderId"=parent_id;
 SELECT COALESCE(jsonb_agg(c."id"::text ORDER BY c."id"),'[]'::jsonb) INTO choices FROM "OrderSupplyRemedyChoice" c
  WHERE c."orderId"=parent_id AND NOT EXISTS(SELECT 1 FROM "OrderSupplyRemedyChoice" later WHERE later."supplyExceptionId"=c."supplyExceptionId" AND later."orderVersion">c."orderVersion");
 IF EXISTS(SELECT 1 FROM "OrderSupplyRemedyChoice" c WHERE c."id"::text IN (SELECT jsonb_array_elements_text(choices)) AND
  (c."choice"='TECHNICAL_REVIEW' OR (c."choice"='SUITABLE_ALTERNATIVE_REVIEW' AND NOT EXISTS(SELECT 1 FROM "PartsQuote" WHERE "supplyRemedyChoiceId"=c."id" AND "status"='ACCEPTED'))))
 THEN RAISE EXCEPTION 'Preserve technical review and actual customer acceptance of alternatives'; END IF;
 RETURN jsonb_build_object('version','ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1','currency','NGN',
  'outcome',CASE WHEN gross=0 THEN 'NO_CAPTURE_RECORDED' ELSE 'CAPTURED_FUNDS_RETURNED' END,
  'originalKobo',parent."totalKobo"::text,'capturedKobo',gross::text,'refundedKobo',gross::text,'remainingKobo','0',
  'cancelledUnits',original_units,'handedUnits',0,'supplyExceptionIds',concerns,'choiceIds',choices,'captures',captures,'refunds',refunds);
END; $$;

CREATE OR REPLACE FUNCTION aat_preserve_supply_closure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; actual JSONB;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Supply financial closure history is immutable'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF parent."id" IS NULL OR parent."version"<>NEW."orderVersion" OR parent."status" IS DISTINCT FROM NEW."originalStatus"
  OR NEW."createdAt">clock_timestamp()
  OR NEW."createdAt"<GREATEST(
    parent."cancelledAt",
    (SELECT max("createdAt") FROM "OrderSupplyResolution" WHERE "orderId"=parent."id"),
    (SELECT max("createdAt") FROM "OrderPickupHandover" WHERE "orderId"=parent."id"),
    (SELECT max(r."processedAt") FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent."id" AND r."status"='SUCCEEDED'))
 THEN RAISE EXCEPTION 'Record current original order version and actual closure time'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "User" u JOIN "Session" s ON s."userId"=u."id"
  WHERE u."id"=NEW."recordedByUserId" AND u."role" IN ('ADMIN','SUPER_ADMIN') AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL
   AND s."id"=NEW."sessionId" AND s."revokedAt" IS NULL AND s."mfaVerifiedAt" IS NOT NULL
   AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp())
 THEN RAISE EXCEPTION 'A current assured administrator must review supply financial closure'; END IF;
 actual:=CASE WHEN NEW."financialSnapshot"->>'version'='ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1'
  THEN aat_cancelled_supply_snapshot(parent."id") ELSE aat_supply_closure_snapshot(parent."id") END;
 IF NEW."financialSnapshot" IS DISTINCT FROM actual
  OR NEW."resultingStatus" IS DISTINCT FROM (CASE WHEN (actual->>'handedUnits')::bigint>0 THEN 'COMPLETED'::"OrderStatus" ELSE 'CANCELLED'::"OrderStatus" END)
 THEN RAISE EXCEPTION 'Record exact current settlement and actual collected/refunded quantities'; END IF;
 RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION aat_complete_supply_closure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId";
 IF parent."version"<>NEW."orderVersion"+1 OR parent."status" IS DISTINCT FROM NEW."resultingStatus"
  OR (parent."status"='CANCELLED' AND parent."cancelledAt" IS NULL)
  OR (parent."status"='COMPLETED' AND parent."completedAt" IS NULL)
  OR EXISTS(SELECT 1 FROM "OrderPickupAuthorisation" WHERE "orderId"=parent."id" AND "consumedAt" IS NULL AND "revokedAt" IS NULL)
  OR NEW."financialSnapshot" IS DISTINCT FROM (CASE WHEN NEW."financialSnapshot"->>'version'='ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1'
   THEN aat_cancelled_supply_snapshot(parent."id") ELSE aat_supply_closure_snapshot(parent."id") END)
 THEN RAISE EXCEPTION 'Complete the same exact closure, version and private-authority revocation atomically'; END IF;
 RETURN NULL;
END; $$;

ALTER FUNCTION aat_assert_order_supply_clearance(UUID) RENAME TO aat_assert_order_supply_clearance_v122;
CREATE FUNCTION aat_assert_order_supply_clearance(parent_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE recorded JSONB;
BEGIN
 SELECT "financialSnapshot" INTO recorded FROM "OrderSupplyClosure" WHERE "orderId"=parent_id
  AND "financialSnapshot"->>'version'='ORDER_CANCELLED_SUPPLY_RECONCILIATION_V1' ORDER BY "orderVersion" DESC LIMIT 1;
 IF recorded IS NOT NULL THEN
  IF recorded IS DISTINCT FROM aat_cancelled_supply_snapshot(parent_id) THEN RAISE EXCEPTION 'Recheck changed cancellation and actual financial evidence'; END IF;
 ELSE PERFORM aat_assert_order_supply_clearance_v122(parent_id); END IF;
END; $$;
