-- Forward-only: allow actual remaining goods after verified original refunds.
-- Preserve capture history, independent duties, exact original money, all prior
-- handovers and reservations. No stock return, credit, new fee or fake collection.
CREATE OR REPLACE FUNCTION aat_preserve_supply_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
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
  OR (choice."choice"='SUITABLE_ALTERNATIVE_REVIEW' AND NOT EXISTS(SELECT 1 FROM "PartsQuote" q JOIN "Order" o ON o."id"=q."orderId" WHERE q."supplyRemedyChoiceId"=choice."id" AND q."status"='ACCEPTED'))
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
-- Every original case must be resolved, and gross/net money must reconcile.
-- Used/installed/disputed and unknown historical allocation remain review states.
CREATE FUNCTION aat_assert_order_supply_clearance(parent_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE concern RECORD; parent "Order"%ROWTYPE; locked_count BIGINT; gross NUMERIC; returned NUMERIC;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id"=parent_id FOR UPDATE SKIP LOCKED;
 IF parent."id" IS NULL THEN RAISE EXCEPTION 'Original supply evidence is busy'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=parent_id) THEN RETURN; END IF;
 FOR concern IN SELECT e."id",r."id" AS resolution_id FROM "OrderSupplyException" e LEFT JOIN "OrderSupplyResolution" r ON r."supplyExceptionId"=e."id" WHERE e."orderId"=parent_id ORDER BY e."id" LOOP
  PERFORM aat_assert_current_supply_resolution(concern.resolution_id);
 END LOOP;
 PERFORM 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id ORDER BY a."id" FOR SHARE OF a,p SKIP LOCKED;
 GET DIAGNOSTICS locked_count=ROW_COUNT;
 IF locked_count<>(SELECT count(*) FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id)
  OR parent."currency"<>'NGN' OR parent."totalKobo"<=0
  OR EXISTS(SELECT 1 FROM "Payment" WHERE "orderId"=parent_id AND "status" IN ('REQUIRES_PAYMENT','PROCESSING','REQUIRES_REVIEW'))
  OR EXISTS(SELECT 1 FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id AND
   ((a."status"='SUCCESSFUL' AND a."id" IS DISTINCT FROM p."settledAttemptId") OR (a."status"<>'SUCCESSFUL' AND a."status" NOT IN ('FAILED','CANCELLED','ABANDONED'))))
  OR EXISTS(SELECT 1 FROM "Payment" p LEFT JOIN "PaymentAttempt" a ON a."id"=p."settledAttemptId" WHERE p."orderId"=parent_id AND p."status"='SUCCEEDED' AND
   (a."id" IS NULL OR a."paymentId"<>p."id" OR a."status"<>'SUCCESSFUL' OR a."verificationStatus"<>'VERIFIED' OR p."currency"<>'NGN' OR a."currency"<>'NGN'
    OR a."verifiedCurrency" IS DISTINCT FROM 'NGN' OR a."verifiedAmountKobo" IS DISTINCT FROM p."amountKobo" OR a."amountKobo"<>p."amountKobo"
    OR a."paidAt" IS NULL OR a."verifiedAt" IS NULL OR p."succeededAt" IS NULL OR a."paidAt">clock_timestamp() OR a."verifiedAt">clock_timestamp()
    OR p."invoiceId" IS NOT NULL OR p."bookingId" IS NOT NULL OR p."vehicleTransactionId" IS NOT NULL))
  OR EXISTS(SELECT 1 FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId"
   WHERE p."orderId"=parent_id AND r."status" NOT IN ('FAILED','CANCELLED') AND
    (r."status"<>'SUCCEEDED' OR a."id" IS DISTINCT FROM p."settledAttemptId" OR NOT EXISTS(
      SELECT 1 FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."settlementProof"->'refunds') f
      WHERE s."orderId"=parent_id AND f->>'refundId'=r."id"::text AND f->>'paymentAttemptId'=a."id"::text AND f->>'amountKobo'=r."amountKobo"::text)))
  OR EXISTS(SELECT 1 FROM "PaymentAnomaly" n WHERE n."status" IN ('OPEN','INVESTIGATING') AND
   (n."paymentId" IN(SELECT "id" FROM "Payment" WHERE "orderId"=parent_id)
    OR n."paymentAttemptId" IN(SELECT a."id" FROM "PaymentAttempt" a JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id)
    OR n."refundId" IN(SELECT r."id" FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id)))
  OR EXISTS(SELECT 1 FROM "PaymentDispute" d JOIN "PaymentAttempt" a ON a."id"=d."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id AND d."status"<>'WON')
 THEN RAISE EXCEPTION 'Reconcile original receipts, refunds and unknown financial evidence'; END IF;
 SELECT COALESCE(sum("amountKobo"),0) INTO gross FROM "Payment" WHERE "orderId"=parent_id AND "status"='SUCCEEDED';
 SELECT COALESCE(sum(r."amountKobo"),0) INTO returned FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id AND r."status"='SUCCEEDED';
 IF gross<>parent."totalKobo" OR returned>gross THEN RAISE EXCEPTION 'Gross and net original coverage must reconcile exactly'; END IF;
END; $$;

CREATE FUNCTION aat_assert_related_supply_clearance(order_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE original_id UUID;
BEGIN
 FOR original_id IN SELECT DISTINCT c."orderId" FROM "PartsQuote" q JOIN "OrderSupplyRemedyChoice" c ON c."id"=q."supplyRemedyChoiceId" WHERE q."orderId"=order_id ORDER BY c."orderId" LOOP
  PERFORM aat_assert_order_supply_clearance(original_id);
 END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION aat_hold_supply_alternative_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE order_id UUID;
BEGIN
 IF NEW."status" IN ('INITIALIZED','PENDING','PROCESSING') AND NEW."verificationStatus"='UNVERIFIED' THEN
  SELECT "orderId" INTO order_id FROM "Payment" WHERE "id"=NEW."paymentId";
  IF EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=order_id) THEN RAISE EXCEPTION 'Do not charge the original order again after a supply concern'; END IF;
  PERFORM aat_assert_related_supply_clearance(order_id);
 END IF;
 -- Never discard a real successful/late capture because a new action is held.
 RETURN NEW;
END; $$;

CREATE FUNCTION aat_guard_resolved_supply_authorisation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM aat_assert_order_supply_clearance(NEW."orderId");
 PERFORM aat_assert_related_supply_clearance(NEW."orderId");
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW."lines") proposed JOIN "OrderItem" i ON i."id"::text=proposed->>'orderItemId'
  WHERE i."quantity"<(proposed->>'quantity')::bigint
   + COALESCE((SELECT sum(h.quantity) FROM aat_recorded_pickup_units(NEW."orderId") h WHERE h.item_id=i."id"::text),0)
   + COALESCE((SELECT sum((u->>'quantity')::bigint) FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=NEW."orderId" AND u->>'orderItemId'=i."id"::text),0))
 THEN RAISE EXCEPTION 'Authorise only actual remaining goods after resolved refunds'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderPickupAuthorisation_supply_guard" BEFORE INSERT ON "OrderPickupAuthorisation" FOR EACH ROW EXECUTE FUNCTION aat_guard_resolved_supply_authorisation();

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
  THEN RAISE EXCEPTION 'Pickup unit positions must match actual original line identities and bounds'; END IF;
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
-- Revalidate saved evidence on each new physical/payment action, without making
-- the historical administrator/session remain signed in forever.
CREATE FUNCTION aat_assert_current_supply_resolution(resolution_id UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE saved "OrderSupplyResolution"%ROWTYPE; parent "Order"%ROWTYPE;
 concern "OrderSupplyException"%ROWTYPE; choice "OrderSupplyRemedyChoice"%ROWTYPE;
 piece JSONB; expected_amount BIGINT; refunded NUMERIC; locked_count BIGINT;
BEGIN
 SELECT * INTO saved FROM "OrderSupplyResolution" WHERE "id"=resolution_id;
 IF saved."id" IS NULL THEN RAISE EXCEPTION 'Actual supply settlement and physical resolution are required'; END IF;
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

CREATE OR REPLACE FUNCTION aat_preserve_order_pickup_handover() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; entitlement "OrderPickupAuthorisation"%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Pickup handover history is append only'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 SELECT * INTO entitlement FROM "OrderPickupAuthorisation" WHERE "id"=NEW."authorisationId" FOR SHARE;
 IF parent."id" IS NULL OR parent."status"<>'READY' OR parent."readyAt" IS NULL OR parent."paidAt" IS NULL OR parent."version"<>NEW."orderVersion"
  OR entitlement."orderId"<>NEW."orderId" OR entitlement."consumedAt" IS DISTINCT FROM NEW."createdAt" OR entitlement."revokedAt" IS NOT NULL OR entitlement."expiresAt"<=clock_timestamp() THEN
  RAISE EXCEPTION 'Record a current ready order and consume its private authorisation before handover'; END IF;
 IF NOT EXISTS (SELECT 1 FROM "User" u LEFT JOIN "StaffProfile" s ON s."userId"=u."id" WHERE u."id"=NEW."performedByUserId" AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL
  AND (u."role" IN ('ADMIN','SUPER_ADMIN') OR (u."role"='STAFF' AND s."branchId"=parent."branchId"))) THEN
  RAISE EXCEPTION 'Only the authorised active branch operator may record handover'; END IF;
 IF jsonb_array_length(NEW."lines")<>(SELECT count(DISTINCT line->>'orderItemId') FROM jsonb_array_elements(NEW."lines") line)
 OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(NEW."lines") line
  LEFT JOIN "OrderItem" item ON item."id"=(line->>'orderItemId')::uuid
  LEFT JOIN LATERAL (SELECT authorised FROM jsonb_array_elements(entitlement."lines") authorised WHERE authorised->>'orderItemId'=line->>'orderItemId') allowed ON true
  WHERE item."id" IS NULL OR item."orderId"<>NEW."orderId" OR allowed.authorised IS NULL OR NOT COALESCE(line->>'quantity' ~ '^[1-9][0-9]{0,5}$',false)
   OR (line->>'quantity')::integer NOT BETWEEN 1 AND (allowed.authorised->>'quantity')::integer
   OR (line->>'quantity')::integer+COALESCE((SELECT sum((prior->>'quantity')::integer) FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") prior WHERE h."orderId"=NEW."orderId" AND prior->>'orderItemId'=line->>'orderItemId'),0)+COALESCE((SELECT sum((u->>'quantity')::bigint) FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=NEW."orderId" AND u->>'orderItemId'=line->>'orderItemId'),0)>item."quantity"
 ) THEN RAISE EXCEPTION 'Pickup handover exceeds an authorised or remaining quantity'; END IF;
 IF NEW."completedOrder" IS DISTINCT FROM (NOT EXISTS (
  SELECT 1 FROM "OrderItem" item WHERE item."orderId"=NEW."orderId" AND item."quantity">COALESCE((SELECT sum((line->>'quantity')::integer) FROM "OrderPickupHandover" h CROSS JOIN LATERAL jsonb_array_elements(h."lines") line WHERE h."orderId"=NEW."orderId" AND line->>'orderItemId'=item."id"::text),0)+COALESCE((SELECT sum((line->>'quantity')::integer) FROM jsonb_array_elements(NEW."lines") line WHERE line->>'orderItemId'=item."id"::text),0)+COALESCE((SELECT sum((u->>'quantity')::bigint) FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=NEW."orderId" AND u->>'orderItemId'=item."id"::text),0)
 )) THEN RAISE EXCEPTION 'Pickup completion must match every actual remaining quantity'; END IF;
 PERFORM aat_assert_order_supply_clearance(NEW."orderId");
 PERFORM aat_assert_related_supply_clearance(NEW."orderId");
 IF EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=NEW."orderId") OR EXISTS(SELECT 1 FROM "PartsQuote" WHERE "orderId"=NEW."orderId" AND "supplyRemedyChoiceId" IS NOT NULL) THEN
  IF NEW."financialSnapshot"->>'version' IS DISTINCT FROM 'ORDER_PICKUP_CLEARANCE_V2'
   OR NEW."financialSnapshot"->'coverage'->>'originalKobo' IS DISTINCT FROM parent."totalKobo"::text
   OR NEW."financialSnapshot"->'coverage'->>'refundedKobo' IS DISTINCT FROM (SELECT COALESCE(sum(r."amountKobo"),0)::text FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=NEW."orderId" AND r."status"='SUCCEEDED')
   OR NEW."financialSnapshot"->'coverage'->>'remainingKobo' IS DISTINCT FROM (SELECT (parent."totalKobo"-COALESCE(sum(r."amountKobo"),0))::text FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=NEW."orderId" AND r."status"='SUCCEEDED')
   OR jsonb_typeof(NEW."financialSnapshot"->'supplyResolutions') IS DISTINCT FROM 'array'
   OR (SELECT count(*) FROM "OrderSupplyResolution" WHERE "orderId"=NEW."orderId")<>jsonb_array_length(NEW."financialSnapshot"->'supplyResolutions')
   OR EXISTS(SELECT 1 FROM "OrderSupplyResolution" s WHERE s."orderId"=NEW."orderId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW."financialSnapshot"->'supplyResolutions') AS actual_resolution(value) WHERE actual_resolution.value->>'id'=s."id"::text))
  THEN RAISE EXCEPTION 'Record current original, refunded and remaining coverage with its actual supply resolution'; END IF;
  IF EXISTS(SELECT 1 FROM "PartsQuote" q JOIN "OrderSupplyRemedyChoice" c ON c."id"=q."supplyRemedyChoiceId" JOIN "OrderSupplyResolution" s ON s."orderId"=c."orderId"
   WHERE q."orderId"=NEW."orderId" AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW."financialSnapshot"->'relatedSupplyResolutions') linked
    WHERE linked->>'orderId'=c."orderId"::text AND linked->'resolutionIds' @> to_jsonb(ARRAY[s."id"::text])))
  THEN RAISE EXCEPTION 'Keep the actual resolved original in replacement collection evidence'; END IF;
 END IF;
 RETURN NEW;
END; $$;

CREATE FUNCTION aat_guard_supply_fulfilment_stage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status" IS DISTINCT FROM OLD."status" AND NEW."status" IN ('CONFIRMED','PROCESSING','READY') THEN
  PERFORM aat_assert_order_supply_clearance(NEW."id");
  PERFORM aat_assert_related_supply_clearance(NEW."id");
  IF EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=NEW."id") AND NOT EXISTS(
    SELECT 1 FROM "OrderItem" i WHERE i."orderId"=NEW."id" AND i."quantity">
    COALESCE((SELECT sum(h.quantity) FROM aat_recorded_pickup_units(NEW."id") h WHERE h.item_id=i."id"::text),0)+
    COALESCE((SELECT sum((u->>'quantity')::bigint) FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=NEW."id" AND u->>'orderItemId'=i."id"::text),0))
  THEN RAISE EXCEPTION 'No actual remaining goods need a fulfilment stage; review financial closure'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Order_resolved_supply_stage" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION aat_guard_supply_fulfilment_stage();
