-- Additive financial/physical evidence. Existing supply/payment/collection holds
-- remain in place until eligibility uses current settlement and resolved ranges.
CREATE TABLE "OrderSupplyResolution" (
 "id" UUID PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "supplyExceptionId" UUID NOT NULL REFERENCES "OrderSupplyException"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "choiceId" UUID NOT NULL REFERENCES "OrderSupplyRemedyChoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "recordedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "settlementProof" JSONB NOT NULL,
 "unfulfilledLines" JSONB NOT NULL,
 "previouslyHandedLines" JSONB NOT NULL,
 "reason" VARCHAR(1000) NOT NULL CHECK (length(btrim("reason"))>=12),
 "idempotencyKey" UUID NOT NULL,
 "requestHash" CHAR(64) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OrderSupplyResolution_supplyExceptionId_key" ON "OrderSupplyResolution"("supplyExceptionId");
CREATE UNIQUE INDEX "OrderSupplyResolution_choiceId_key" ON "OrderSupplyResolution"("choiceId");
CREATE UNIQUE INDEX "OrderSupplyResolution_idempotencyKey_key" ON "OrderSupplyResolution"("idempotencyKey");
CREATE UNIQUE INDEX "OrderSupplyResolution_orderId_orderVersion_key" ON "OrderSupplyResolution"("orderId","orderVersion");

-- Legacy quantity-only evidence consumes the original dense prefix. Explicit
-- ranges preserve positions even when a later forward workflow permits gaps.
CREATE FUNCTION aat_recorded_pickup_units(parent_id UUID)
RETURNS TABLE(item_id TEXT, unit_offset BIGINT, quantity BIGINT)
LANGUAGE SQL STABLE AS $$
 SELECT piece->>'orderItemId', (piece->>'offset')::bigint, (piece->>'quantity')::bigint
 FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."unitRanges") piece
 WHERE h."orderId"=parent_id AND h."unitRanges" IS NOT NULL
 UNION ALL
 SELECT piece->>'orderItemId',
  COALESCE((SELECT sum((prior_piece->>'quantity')::bigint)
   FROM "OrderPickupHandover" prior CROSS JOIN LATERAL jsonb_array_elements(prior."lines") prior_piece
   WHERE prior."orderId"=parent_id AND (prior."orderVersion",prior."id")<(h."orderVersion",h."id")
    AND prior_piece->>'orderItemId'=piece->>'orderItemId'),0)::bigint,
  (piece->>'quantity')::bigint
 FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") piece
 WHERE h."orderId"=parent_id AND h."unitRanges" IS NULL
$$;

CREATE FUNCTION aat_preserve_supply_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; concern "OrderSupplyException"%ROWTYPE;
 choice "OrderSupplyRemedyChoice"%ROWTYPE; piece JSONB; actual_piece JSONB;
 all_units JSONB; expected_amount BIGINT; proof_amount NUMERIC; refunded NUMERIC;
 expected_quantity BIGINT; actual_quantity BIGINT; overlap_quantity BIGINT;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Supply settlement and physical resolution history is immutable'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 SELECT * INTO concern FROM "OrderSupplyException" WHERE "id"=NEW."supplyExceptionId";
 SELECT * INTO choice FROM "OrderSupplyRemedyChoice" WHERE "id"=NEW."choiceId";
 IF parent."id" IS NULL OR parent."version"<>NEW."orderVersion"
  OR concern."orderId" IS DISTINCT FROM parent."id" OR choice."orderId" IS DISTINCT FROM parent."id"
  OR choice."supplyExceptionId" IS DISTINCT FROM concern."id"
  OR concern."kind"='USED_INSTALLED_OR_DIAGNOSIS_DISPUTE'
  OR choice."choice" NOT IN ('REFUND_REVIEW','SUITABLE_ALTERNATIVE_REVIEW')
  OR EXISTS(SELECT 1 FROM "OrderSupplyRemedyChoice" WHERE "supplyExceptionId"=concern."id" AND "orderVersion">choice."orderVersion")
  OR (choice."choice"='SUITABLE_ALTERNATIVE_REVIEW' AND NOT EXISTS(SELECT 1 FROM "PartsQuote" q JOIN "Order" o ON o."id"=q."orderId" WHERE q."supplyRemedyChoiceId"=choice."id" AND q."status"='ACCEPTED' AND o."status"<>'CANCELLED'))
  OR concern."monetaryBasis"->>'status' IS DISTINCT FROM 'SAVED_ORDER_ALLOCATION'
  OR concern."monetaryBasis"->>'feeKobo' IS DISTINCT FROM '0'
  OR NOT COALESCE(concern."monetaryBasis"->'amounts'->>'totalKobo' ~ '^[1-9][0-9]{0,18}$',false)
 THEN RAISE EXCEPTION 'Resolve the actual current customer remedy and original monetary allocation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "User" u JOIN "Session" s ON s."userId"=u."id"
   WHERE u."id"=NEW."recordedByUserId" AND u."role" IN ('ADMIN','SUPER_ADMIN') AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL
    AND s."id"=NEW."sessionId" AND s."revokedAt" IS NULL AND s."mfaVerifiedAt" IS NOT NULL
    AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp())
 THEN RAISE EXCEPTION 'A current assured administrator must review actual supply settlement'; END IF;
 IF EXISTS(SELECT 1 FROM "OrderPickupClaim" WHERE "orderId"=parent."id" AND "cancelledAt" IS NULL AND "consumedAt" IS NULL)
  OR (parent."status"='COMPLETED' AND NOT EXISTS(SELECT 1 FROM "OrderPickupHandover" WHERE "orderId"=parent."id"))
 THEN RAISE EXCEPTION 'Reconcile active pickup review or missing historical handover before supply resolution'; END IF;
 expected_amount:=(concern."monetaryBasis"->'amounts'->>'totalKobo')::bigint;
 IF NEW."createdAt">clock_timestamp() OR NEW."settlementProof"->>'version' IS DISTINCT FROM 'ORDER_REFUND_SETTLEMENT_20261110_V1'
  OR NEW."settlementProof"->>'orderId' IS DISTINCT FROM parent."id"::text
  OR NEW."settlementProof"->>'choiceId' IS DISTINCT FROM choice."id"::text
  OR NEW."settlementProof"->>'supplyExceptionId' IS DISTINCT FROM concern."id"::text
  OR NEW."settlementProof"->>'currency' IS DISTINCT FROM 'NGN'
  OR NEW."settlementProof"->>'amountKobo' IS DISTINCT FROM expected_amount::text
  OR jsonb_typeof(NEW."settlementProof"->'refunds') IS DISTINCT FROM 'array'
  OR jsonb_array_length(NEW."settlementProof"->'refunds')=0
 THEN RAISE EXCEPTION 'Use actual verified original refund evidence for this case'; END IF;
 -- Lock the same original financial identities; active unverifiable rows cannot
 -- be omitted from the proof, including earlier unbound/other-choice refunds.
 PERFORM 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId"
  WHERE r."supplyRemedyChoiceId"=choice."id" FOR SHARE OF r,a,p;
 IF EXISTS(SELECT 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId"
   WHERE p."orderId"=parent."id" AND r."status" NOT IN ('FAILED','CANCELLED') AND r."supplyRemedyChoiceId" IS NULL)
  OR EXISTS(SELECT 1 FROM "Refund" r JOIN "OrderSupplyRemedyChoice" c ON c."id"=r."supplyRemedyChoiceId"
   WHERE c."supplyExceptionId"=concern."id" AND r."status" NOT IN ('FAILED','CANCELLED') AND c."id"<>choice."id")
 THEN RAISE EXCEPTION 'Reconcile unbound or earlier-choice refunds before resolving affected units'; END IF;
 SELECT COALESCE(sum(r."amountKobo"),0) INTO refunded FROM "Refund" r WHERE r."supplyRemedyChoiceId"=choice."id" AND r."status" NOT IN ('FAILED','CANCELLED');
 IF refunded<>expected_amount OR jsonb_array_length(NEW."settlementProof"->'refunds')<>(SELECT count(*) FROM "Refund" WHERE "supplyRemedyChoiceId"=choice."id" AND "status" NOT IN ('FAILED','CANCELLED'))
  OR jsonb_array_length(NEW."settlementProof"->'refunds')<>(SELECT count(DISTINCT value->>'refundId') FROM jsonb_array_elements(NEW."settlementProof"->'refunds'))
 THEN RAISE EXCEPTION 'Resolve exactly the original affected amount once'; END IF;
 FOR piece IN SELECT value FROM jsonb_array_elements(NEW."settlementProof"->'refunds') LOOP
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
 IF jsonb_typeof(NEW."unfulfilledLines") IS DISTINCT FROM 'array' OR jsonb_typeof(NEW."previouslyHandedLines") IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Record actual physical disposition without inventing handover'; END IF;
 all_units:=NEW."unfulfilledLines"||NEW."previouslyHandedLines";
 IF jsonb_array_length(all_units)>20000 THEN RAISE EXCEPTION 'Physical evidence exceeds the supported bound'; END IF;
 FOR piece IN SELECT value FROM jsonb_array_elements(all_units) LOOP
  IF jsonb_typeof(piece) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(piece))<>3
   OR NOT COALESCE(piece->>'offset'~'^(0|[1-9][0-9]{0,4})$',false) OR NOT COALESCE(piece->>'quantity'~'^[1-9][0-9]{0,5}$',false)
  THEN RAISE EXCEPTION 'Use actual bounded unit ranges'; END IF;
  SELECT COALESCE(sum(GREATEST(0,LEAST((a->>'offset')::bigint+(a->>'quantity')::bigint,(piece->>'offset')::bigint+(piece->>'quantity')::bigint)-GREATEST((a->>'offset')::bigint,(piece->>'offset')::bigint))),0) INTO actual_quantity
   FROM jsonb_array_elements(concern."affectedLines") a WHERE a->>'orderItemId'=piece->>'orderItemId';
  IF actual_quantity<>(piece->>'quantity')::bigint THEN RAISE EXCEPTION 'Resolution includes units outside its original affected ranges'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(all_units) WITH ORDINALITY a(piece,pos), jsonb_array_elements(all_units) WITH ORDINALITY b(piece,pos)
  WHERE a.pos<b.pos AND a.piece->>'orderItemId'=b.piece->>'orderItemId' AND (a.piece->>'offset')::bigint<(b.piece->>'offset')::bigint+(b.piece->>'quantity')::bigint AND (b.piece->>'offset')::bigint<(a.piece->>'offset')::bigint+(a.piece->>'quantity')::bigint)
 THEN RAISE EXCEPTION 'A physical unit cannot be resolved twice'; END IF;
 SELECT COALESCE(sum((value->>'quantity')::bigint),0) INTO expected_quantity FROM jsonb_array_elements(concern."affectedLines");
 SELECT COALESCE(sum((value->>'quantity')::bigint),0) INTO actual_quantity FROM jsonb_array_elements(all_units);
 IF actual_quantity<>expected_quantity THEN RAISE EXCEPTION 'Resolve all and only this affected scope'; END IF;
 FOR piece IN SELECT value FROM jsonb_array_elements(all_units) LOOP
  SELECT COALESCE(sum(GREATEST(0,LEAST(h.unit_offset+h.quantity,(piece->>'offset')::bigint+(piece->>'quantity')::bigint)-GREATEST(h.unit_offset,(piece->>'offset')::bigint))),0) INTO overlap_quantity
   FROM aat_recorded_pickup_units(parent."id") h WHERE h.item_id=piece->>'orderItemId';
  IF (NEW."unfulfilledLines" @> jsonb_build_array(piece) AND overlap_quantity<>0)
   OR (NEW."previouslyHandedLines" @> jsonb_build_array(piece) AND overlap_quantity<>(piece->>'quantity')::bigint)
  THEN RAISE EXCEPTION 'Physical disposition must match actual immutable handover'; END IF;
 END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderSupplyResolution_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderSupplyResolution" FOR EACH ROW EXECUTE FUNCTION aat_preserve_supply_resolution();
