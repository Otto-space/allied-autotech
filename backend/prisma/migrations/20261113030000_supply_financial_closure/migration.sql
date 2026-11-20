-- Append-only financial closure; original prices and actual handovers remain.
CREATE TABLE "OrderSupplyClosure" (
 "id" UUID PRIMARY KEY,
 "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "recordedByUserId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "orderVersion" INTEGER NOT NULL CHECK ("orderVersion">=0),
 "originalStatus" "OrderStatus" NOT NULL,
 "resultingStatus" "OrderStatus" NOT NULL CHECK ("resultingStatus" IN ('CANCELLED','COMPLETED')),
 "financialSnapshot" JSONB NOT NULL,
 "financialReviewHash" CHAR(64) NOT NULL CHECK ("financialReviewHash" ~ '^[a-f0-9]{64}$'),
 "reason" VARCHAR(1000) NOT NULL CHECK (length(btrim("reason"))>=12),
 "idempotencyKey" UUID NOT NULL,
 "requestHash" CHAR(64) NOT NULL CHECK ("requestHash" ~ '^[a-f0-9]{64}$'),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "OrderSupplyClosure_idempotencyKey_key" ON "OrderSupplyClosure"("idempotencyKey");
CREATE UNIQUE INDEX "OrderSupplyClosure_orderId_orderVersion_key" ON "OrderSupplyClosure"("orderId","orderVersion");
CREATE UNIQUE INDEX "OrderSupplyClosure_orderId_financialReviewHash_key" ON "OrderSupplyClosure"("orderId","financialReviewHash");

-- Actual immutable positions, not a zero-quantity collection or inferred stock return.
CREATE FUNCTION aat_supply_closure_snapshot(parent_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; gross BIGINT; returned BIGINT;
 original_units BIGINT; handed_units BIGINT; excluded_units BIGINT;
 resolution_ids JSONB; handover_ids JSONB;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id"=parent_id FOR UPDATE SKIP LOCKED;
 IF parent."id" IS NULL OR parent."fulfillmentMethod"<>'COLLECTION' OR parent."paidAt" IS NULL
  OR NOT EXISTS(SELECT 1 FROM "OrderSupplyResolution" WHERE "orderId"=parent_id)
 THEN RAISE EXCEPTION 'Use an actual paid collection order with resolved original supply refunds'; END IF;
 PERFORM aat_assert_order_supply_clearance(parent_id);
 PERFORM aat_assert_related_supply_clearance(parent_id);
 IF EXISTS(SELECT 1 FROM "OrderPickupClaim" WHERE "orderId"=parent_id AND "cancelledAt" IS NULL AND "consumedAt" IS NULL)
  OR EXISTS(SELECT 1 FROM "InventoryReservation" WHERE "referenceType"='ORDER' AND "referenceId"=parent_id::text AND "status"='ACTIVE')
 THEN RAISE EXCEPTION 'Resolve active pickup review and release only actual active allocations before closure'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "OrderItem" WHERE "orderId"=parent_id)
  OR EXISTS(SELECT 1 FROM "OrderItem" i WHERE i."orderId"=parent_id AND i."quantity"<>
   COALESCE((SELECT sum(h.quantity) FROM aat_recorded_pickup_units(parent_id) h WHERE h.item_id=i."id"::text),0)+
   COALESCE((SELECT sum((u->>'quantity')::bigint) FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=parent_id AND u->>'orderItemId'=i."id"::text),0))
 THEN RAISE EXCEPTION 'Actual collected and refunded unfulfilled units must cover every original item exactly'; END IF;
 SELECT COALESCE(sum("quantity"),0) INTO original_units FROM "OrderItem" WHERE "orderId"=parent_id;
 SELECT COALESCE(sum(quantity),0) INTO handed_units FROM aat_recorded_pickup_units(parent_id);
 SELECT COALESCE(sum((u->>'quantity')::bigint),0) INTO excluded_units FROM "OrderSupplyResolution" s CROSS JOIN LATERAL jsonb_array_elements(s."unfulfilledLines") u WHERE s."orderId"=parent_id;
 IF (parent."status"='COMPLETED' AND handed_units=0) OR (parent."status"='CANCELLED' AND handed_units>0)
 THEN RAISE EXCEPTION 'Reconcile historical order status and actual physical history before supply closure'; END IF;
 SELECT COALESCE(sum("amountKobo"),0) INTO gross FROM "Payment" WHERE "orderId"=parent_id AND "status"='SUCCEEDED';
 SELECT COALESCE(sum(r."amountKobo"),0) INTO returned FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent_id AND r."status"='SUCCEEDED';
 IF returned<=0 OR (handed_units=0 AND returned<>gross) THEN RAISE EXCEPTION 'Reconcile the exact original refund; no uncollected original amount may be silently retained'; END IF;
 SELECT COALESCE(jsonb_agg("id"::text ORDER BY "id"),'[]'::jsonb) INTO resolution_ids FROM "OrderSupplyResolution" WHERE "orderId"=parent_id;
 SELECT COALESCE(jsonb_agg("id"::text ORDER BY "id"),'[]'::jsonb) INTO handover_ids FROM "OrderPickupHandover" WHERE "orderId"=parent_id;
 RETURN jsonb_build_object('version','ORDER_SUPPLY_CLOSURE_V1','currency','NGN',
  'originalKobo',gross::text,'refundedKobo',returned::text,'remainingKobo',(gross-returned)::text,
  'supplyResolutionIds',resolution_ids,'handoverIds',handover_ids,
  'originalUnits',original_units,'refundedUnfulfilledUnits',excluded_units,'handedUnits',handed_units);
END; $$;

CREATE FUNCTION aat_preserve_supply_closure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE; actual JSONB;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Supply financial closure history is immutable'; END IF;
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId" FOR UPDATE;
 IF parent."id" IS NULL OR parent."version"<>NEW."orderVersion" OR parent."status" IS DISTINCT FROM NEW."originalStatus"
  OR NEW."createdAt">clock_timestamp()
  OR NEW."createdAt"<GREATEST(
    (SELECT max("createdAt") FROM "OrderSupplyResolution" WHERE "orderId"=parent."id"),
    (SELECT max("createdAt") FROM "OrderPickupHandover" WHERE "orderId"=parent."id"),
    (SELECT max(r."processedAt") FROM "Refund" r JOIN "PaymentAttempt" a ON a."id"=r."paymentAttemptId" JOIN "Payment" p ON p."id"=a."paymentId" WHERE p."orderId"=parent."id" AND r."status"='SUCCEEDED'))
 THEN RAISE EXCEPTION 'Record current original order version and actual closure time'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "User" u JOIN "Session" s ON s."userId"=u."id"
  WHERE u."id"=NEW."recordedByUserId" AND u."role" IN ('ADMIN','SUPER_ADMIN') AND u."status"='ACTIVE' AND u."emailVerifiedAt" IS NOT NULL
   AND s."id"=NEW."sessionId" AND s."revokedAt" IS NULL AND s."mfaVerifiedAt" IS NOT NULL
   AND s."expiresAt">clock_timestamp() AND s."idleExpiresAt">clock_timestamp())
 THEN RAISE EXCEPTION 'A current assured administrator must review supply financial closure'; END IF;
 actual:=aat_supply_closure_snapshot(parent."id");
 IF NEW."financialSnapshot" IS DISTINCT FROM actual
  OR NEW."resultingStatus" IS DISTINCT FROM (CASE WHEN (actual->>'handedUnits')::bigint>0 THEN 'COMPLETED'::"OrderStatus" ELSE 'CANCELLED'::"OrderStatus" END)
 THEN RAISE EXCEPTION 'Record exact current settlement and actual collected/refunded quantities'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "OrderSupplyClosure_guard" BEFORE INSERT OR UPDATE OR DELETE ON "OrderSupplyClosure" FOR EACH ROW EXECUTE FUNCTION aat_preserve_supply_closure();
CREATE TRIGGER "OrderSupplyClosure_truncate_guard" BEFORE TRUNCATE ON "OrderSupplyClosure" FOR EACH STATEMENT EXECUTE FUNCTION aat_preserve_supply_closure();

CREATE FUNCTION aat_complete_supply_closure() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent "Order"%ROWTYPE;
BEGIN
 SELECT * INTO parent FROM "Order" WHERE "id"=NEW."orderId";
 IF parent."version"<>NEW."orderVersion"+1 OR parent."status" IS DISTINCT FROM NEW."resultingStatus"
  OR (parent."status"='CANCELLED' AND parent."cancelledAt" IS NULL)
  OR (parent."status"='COMPLETED' AND parent."completedAt" IS NULL)
  OR EXISTS(SELECT 1 FROM "OrderPickupAuthorisation" WHERE "orderId"=parent."id" AND "consumedAt" IS NULL AND "revokedAt" IS NULL)
  OR NEW."financialSnapshot" IS DISTINCT FROM aat_supply_closure_snapshot(parent."id")
 THEN RAISE EXCEPTION 'Complete the same exact closure, version and private-authority revocation atomically'; END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER "OrderSupplyClosure_outcome" AFTER INSERT ON "OrderSupplyClosure" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION aat_complete_supply_closure();

-- Ordinary collection still needs its last physical handover. A resolved refunded
-- remainder has a distinct immutable financial closure; it cannot fabricate one.
CREATE OR REPLACE FUNCTION aat_require_order_pickup_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='COMPLETED' AND OLD."status"<>'COMPLETED' AND NEW."fulfillmentMethod"='COLLECTION' AND NOT EXISTS(
  SELECT 1 FROM "OrderPickupHandover" h WHERE h."orderId"=NEW."id" AND h."completedOrder" AND h."orderVersion"=OLD."version")
  AND NOT EXISTS(SELECT 1 FROM "OrderSupplyClosure" c WHERE c."orderId"=NEW."id" AND c."orderVersion"=OLD."version" AND c."resultingStatus"='COMPLETED'
   AND c."financialSnapshot"=aat_supply_closure_snapshot(NEW."id"))
 THEN RAISE EXCEPTION 'Complete a collection order through verified private pickup handover or actual resolved supply financial closure'; END IF;
 RETURN NEW;
END; $$;
CREATE FUNCTION aat_require_supply_cancellation_closure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."status"='CANCELLED' AND OLD."status"<>'CANCELLED' AND OLD."paidAt" IS NOT NULL
  AND EXISTS(SELECT 1 FROM "OrderSupplyException" WHERE "orderId"=NEW."id")
  AND NOT EXISTS(SELECT 1 FROM "OrderSupplyClosure" c WHERE c."orderId"=NEW."id" AND c."orderVersion"=OLD."version" AND c."resultingStatus"='CANCELLED'
   AND c."financialSnapshot"=aat_supply_closure_snapshot(NEW."id"))
 THEN RAISE EXCEPTION 'Close the actual independently settled supply obligation without restocking consumed goods'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER "Order_supply_cancellation_closure" BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION aat_require_supply_cancellation_closure();
