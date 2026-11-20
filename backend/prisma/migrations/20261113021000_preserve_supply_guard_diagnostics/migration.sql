-- Preserve established guard diagnostics; all financial, access and physical
-- predicates from the applied forward migration remain identical.

CREATE OR REPLACE FUNCTION aat_assert_current_supply_resolution(resolution_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE saved "OrderSupplyResolution"%ROWTYPE; parent "Order"%ROWTYPE;
 concern "OrderSupplyException"%ROWTYPE; choice "OrderSupplyRemedyChoice"%ROWTYPE;
 piece JSONB; expected_amount BIGINT; refunded NUMERIC; locked_count BIGINT;
BEGIN
 SELECT * INTO saved FROM "OrderSupplyResolution" WHERE "id"=resolution_id;
 IF saved."id" IS NULL THEN RAISE EXCEPTION 'Verify original affected goods financial resolution; actual supply settlement and physical resolution are required'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=saved."orderId" FOR UPDATE SKIP LOCKED;
 SELECT * INTO concern FROM "OrderSupplyException" WHERE "id"=saved."supplyExceptionId";
 SELECT * INTO choice FROM "OrderSupplyRemedyChoice" WHERE "id"=saved."choiceId";
 IF parent."id" IS NULL
  OR concern."orderId" IS DISTINCT FROM parent."id" OR choice."orderId" IS DISTINCT FROM parent."id"
  OR choice."supplyExceptionId" IS DISTINCT FROM concern."id"
  OR concern."kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE'
  OR choice."choice" NOT IN ('REFUND_REVIEW','SUITABLE_ALTERNATIVE_REVIEW')
  OR EXISTS(SELECT 1 FROM "OrderSupplyRemedyChoice" WHERE "supplyExceptionId"=concern."id" AND "orderVersion">choice."orderVersion")
  OR (choice."choice"='SUITABLE_ALTERNATIVE_REVIEW' AND NOT EXISTS(SELECT 1 FROM "PartsQuote" q JOIN "Order" o ON o."id"=q."orderId" WHERE q."supplyRemedyChoiceId"=choice."id" AND q."status"='ACCEPTED'))
  OR concern."monetaryBasis"->>'status' IS DISTINCT FROM 'SAVED_ORDER_ALLOCATION'
  OR concern."monetaryBasis"->>'feeKobo' IS DISTINCT FROM '0'
  OR NOT COALESCE(concern."monetaryBasis"->'amounts'->>'totalKobo' ~ '^[1-9][0-9]{0,18}$',false)
 THEN RAISE EXCEPTION 'Resolve the actual current customer remedy and original monetary allocation'; END IF;
 expected_amount:=(concern."monetaryBasis"->'amounts'->>'totalKobo')::bigint;
 IF saved."createdAt">clock_timestamp() OR saved."settlementProof"->>'version' IS DISTINCT FROM 'ORDER_REFUND_SETTLEMENT_20261110_V1'
  OR saved."settlementProof"->>'orderId' IS DISTINCT FROM parent."id"::text
  OR saved."settlementProof"->>'choiceId' IS DISTINCT FROM choice."id"::text
  OR saved."settlementProof"->>'supplyExceptionId' IS DISTINCT FROM concern."id"::text
  OR saved."settlementProof"->>'currency' IS DISTINCT FROM 'NGN'
  OR saved."settlementProof"->>'amountKobo' IS DISTINCT FROM expected_amount::text
  OR jsonb_typeof(saved."settlementProof"->'refunds') IS DISTINCT FROM 'array'
  OR jsonb_array_length(saved."settlementProof"->'refunds')=0
 THEN RAISE EXCEPTION 'Use actual verified original refund evidence for this case'; END IF;
 -- Lock the same original financial identities; active unverifiable rows cannot
 -- be omitted from the proof, including earlier unbound/other-choice refunds.
 PERFORM 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId"
  WHERE r."supplyRemedyChoiceId"=choice."id" FOR SHARE OF r,a,p SKIP LOCKED;
 GET DIAGNOSTICS locked_count=ROW_COUNT;
 IF locked_count<>(SELECT count(*) FROM "Refund" WHERE "supplyRemedyChoiceId"=choice."id") THEN RAISE EXCEPTION 'Original refund proof is busy'; END IF;
 IF EXISTS(SELECT 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId"
   WHERE p."orderId"=parent."id" AND r."status" NOT IN ('FAILED','CANCELLED') AND r."supplyRemedyChoiceId" IS NULL)
  OR EXISTS(SELECT 1 FROM "Refund" r JOIN "OrderSupplyRemedyChoice" c ON c."id"=r."supplyRemedyChoiceId"
   WHERE c."supplyExceptionId"=concern."id" AND r."status" NOT IN ('FAILED','CANCELLED') AND c."id"<>choice."id")
 THEN RAISE EXCEPTION 'Reconcile unbound or earlier-choice refunds before resolving affected units'; END IF;
 SELECT COALESCE(sum(r."amountKobo"),0) INTO refunded FROM "Refund" r WHERE r."supplyRemedyChoiceId"=choice."id" AND r."status" NOT IN ('FAILED','CANCELLED');
 IF refunded<>expected_amount OR jsonb_array_length(saved."settlementProof"->'refunds')<>(SELECT count(*) FROM "Refund" WHERE "supplyRemedyChoiceId"=choice."id" AND "status" NOT IN ('FAILED','CANCELLED'))
  OR jsonb_array_length(saved."settlementProof"->'refunds')<>(SELECT count(DISTINCT value->>'refundId') FROM jsonb_array_elements(saved."settlementProof"->'refunds'))
 THEN RAISE EXCEPTION 'Resolve exactly the original affected amount once'; END IF;
 FOR piece IN SELECT value FROM jsonb_array_elements(saved."settlementProof"->'refunds') LOOP
  IF NOT EXISTS(SELECT 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" JOIN "PaymentLedgerEntry" l ON l."refundId"=r."id"
   WHERE r."id"::text=piece->>'refundId' AND r."supplyRemedyChoiceId"=choice."id" AND r."status"='SUCCEEDED' AND r."authorizationKind"='HUMAN'
    AND r."currency"='NGN' AND r."amountKobo">0 AND r."amountKobo"<=a."amountKobo" AND r."amountKobo"::text=piece->>'amountKobo'
    AND r."approvedAt" IS NOT NULL AND r."processedAt">=r."approvedAt" AND r."processedAt"<=clock_timestamp()
    AND r."processedAt"=(piece->>'processedAt')::timestamp AND r."requestedByUserId"<>r."approvedByUserId"
    AND a."id"::text=piece->>'paymentAttemptId' AND a."provider"::text=piece->>'source' AND a."status"='SUCCESSFUL' AND a."verificationStatus"='VERIFIED'
    AND a."currency"='NGN' AND a."verifiedCurrency"='NGN' AND a."verifiedAmountKobo"=a."amountKobo" AND a."amountKobo"=p."amountKobo" AND p."currency"='NGN' AND p."orderId"=parent."id"
    AND a."paidAt"<=clock_timestamp() AND a."verifiedAt"<=clock_timestamp()
    AND ((a."provider"='MANUAL' AND r."providerStatus"='BANK_TRANSFER_CHECKED' AND r."transferredByUserId"<>r."requestedByUserId" AND r."transferredByUserId"<>r."approvedByUserId"
      AND r."checkedByUserId"<>r."requestedByUserId" AND r."checkedByUserId"<>r."approvedByUserId" AND r."checkedByUserId"<>r."transferredByUserId"
      AND r."bankTransferAt">=r."approvedAt" AND r."transferRecordedAt">=r."bankTransferAt" AND r."checkedAt">=r."transferRecordedAt" AND r."processedAt">=r."checkedAt"
      AND length(btrim(r."bankReference"))>0 AND length(r."evidenceObjectKey")>0 AND r."evidenceSha256"~'^[a-f0-9]{64}$' AND r."beneficiaryEncrypted" IS NOT NULL AND r."beneficiaryEncrypted"<>'null'::jsonb)
     OR (a."provider"<>'MANUAL' AND length(btrim(r."providerRefundId"))>0))
    AND l."id"::text=piece->>'ledgerEntryId' AND l."sourceKey"='refund:'||r."id"::text AND l."type"='REFUND' AND l."direction"='DEBIT' AND l."amountKobo"=r."amountKobo" AND l."currency"='NGN'
    AND l."disputeId" IS NULL AND (l."paymentAttemptId" IS NULL OR l."paymentAttemptId"=a."id") AND l."occurredAt">=r."approvedAt" AND l."occurredAt"<=clock_timestamp()
    AND (SELECT count(*) FROM "PaymentLedgerEntry" WHERE "refundId"=r."id")=1
    AND NOT EXISTS(SELECT 1 FROM "PaymentAnomaly" n WHERE n."status" IN ('OPEN','INVESTIGATING') AND (n."refundId"=r."id" OR n."paymentAttemptId"=a."id" OR n."paymentId"=p."id"))
    AND NOT EXISTS(SELECT 1 FROM "PaymentDispute" d WHERE d."paymentAttemptId"=a."id" AND d."status"<>'WON'))
  THEN RAISE EXCEPTION 'Successful independently verified refund and canonical debit are required'; END IF;
 END LOOP;

 IF EXISTS (SELECT 1 FROM jsonb_array_elements(saved."unfulfilledLines") u JOIN aat_recorded_pickup_units(parent."id") h ON h.item_id=u->>'orderItemId'
  WHERE h.unit_offset<(u->>'offset')::bigint+(u->>'quantity')::bigint AND (u->>'offset')::bigint<h.unit_offset+h.quantity)
 THEN RAISE EXCEPTION 'Refunded unfulfilled units cannot become a physical handover'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION aat_validate_pickup_unit_ranges() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE piece JSONB; original_count INTEGER; excluded BOOLEAN; prior_count BIGINT; proposed_count BIGINT;
BEGIN
 PERFORM 1 FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 SELECT EXISTS(SELECT 1 FROM "OrderSupplyResolution" WHERE "orderId"=NEW."orderId" AND jsonb_array_length("unfulfilledLines")>0) INTO excluded;
 IF NEW."unitRanges" IS NULL THEN
  IF excluded THEN RAISE EXCEPTION 'Resolved unfulfilled goods need explicit physical unit evidence'; END IF;
  RETURN NEW;
 END IF;
 IF jsonb_typeof(NEW."unitRanges") IS DISTINCT FROM 'array' OR jsonb_array_length(NEW."unitRanges") NOT BETWEEN 1 AND 20000
 THEN RAISE EXCEPTION 'Use bounded actual physical unit evidence'; END IF;
 FOR piece IN SELECT value FROM jsonb_array_elements(NEW."unitRanges") LOOP
  SELECT "quantity" INTO original_count FROM "OrderItem" WHERE "orderId"=NEW."orderId" AND "id"::text=piece->>'orderItemId';
  IF original_count IS NULL OR jsonb_typeof(piece) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(piece))<>3
   OR NOT COALESCE(piece->>'offset' ~ '^(0|[1-9][0-9]{0,4})$',false) OR NOT COALESCE(piece->>'quantity' ~ '^[1-9][0-9]{0,5}$',false)
   OR (piece->>'offset')::bigint+(piece->>'quantity')::bigint>original_count
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW."lines") line WHERE line->>'orderItemId'=piece->>'orderItemId')
  THEN RAISE EXCEPTION 'Pickup unit positions must preserve actual physical history, original line identities and bounds'; END IF;
  IF NOT excluded THEN
   SELECT COALESCE(sum((line->>'quantity')::bigint),0) INTO prior_count FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") line WHERE h."orderId"=NEW."orderId" AND line->>'orderItemId'=piece->>'orderItemId';
   SELECT (line->>'quantity')::bigint INTO proposed_count FROM jsonb_array_elements(NEW."lines") line WHERE line->>'orderItemId'=piece->>'orderItemId';
   IF (piece->>'offset')::bigint<prior_count OR (piece->>'offset')::bigint+(piece->>'quantity')::bigint>prior_count+proposed_count
   THEN RAISE EXCEPTION 'Pickup unit positions must preserve actual physical history'; END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM aat_recorded_pickup_units(NEW."orderId") h WHERE h.item_id=piece->>'orderItemId' AND h.unit_offset<(piece->>'offset')::bigint+(piece->>'quantity')::bigint AND (piece->>'offset')::bigint<h.unit_offset+h.quantity)
   OR EXISTS(SELECT 1 FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=NEW."orderId" AND u->>'orderItemId'=piece->>'orderItemId'
    AND (u->>'offset')::bigint<(piece->>'offset')::bigint+(piece->>'quantity')::bigint AND (piece->>'offset')::bigint<(u->>'offset')::bigint+(u->>'quantity')::bigint)
  THEN RAISE EXCEPTION 'A collected or refunded unfulfilled unit cannot be handed over again'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM (SELECT value, max((value->>'offset')::bigint+(value->>'quantity')::bigint) OVER (PARTITION BY value->>'orderItemId' ORDER BY (value->>'offset')::bigint ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_end FROM jsonb_array_elements(NEW."unitRanges")) ranges WHERE prior_end>(value->>'offset')::bigint)
 THEN RAISE EXCEPTION 'Physical unit ranges must not overlap'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW."lines") line WHERE (line->>'quantity')::bigint<>(SELECT COALESCE(sum((selected_range.value->>'quantity')::bigint),0) FROM jsonb_array_elements(NEW."unitRanges") AS selected_range(value) WHERE selected_range.value->>'orderItemId'=line->>'orderItemId'))
 THEN RAISE EXCEPTION 'Physical unit evidence must match every actual handed-over quantity'; END IF;
 RETURN NEW;
END; $$;
