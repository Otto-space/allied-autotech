-- Forward-only: a later zero/failed result must not conceal earlier possible
-- funds or a reversal. Resolve actual capture/return through the existing path.
ALTER FUNCTION aat_cancelled_supply_snapshot(UUID) RENAME TO aat_cancelled_supply_snapshot_v129;
CREATE FUNCTION aat_cancelled_supply_snapshot(parent_id UUID) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE actual JSONB;
BEGIN
 -- This verifier first locks the original, every intent and attempt. A concurrent
 -- provider update cannot arrive between the history check and saved clearance.
 actual:=aat_cancelled_supply_snapshot_v129(parent_id);
 IF EXISTS(SELECT 1 FROM "PaymentAttemptObservation" o
  JOIN "PaymentAttempt" a ON a."id"=o."paymentAttemptId"
  JOIN "Payment" p ON p."id"=a."paymentId"
  WHERE p."orderId"=parent_id AND a."status"<>'SUCCESSFUL' AND (
   o."status" IN ('success','reversed') OR o."paidAt" IS NOT NULL
   OR COALESCE(o."providerFeeKobo",0)<>0
   OR (o."provider"='MONNIFY' AND o."amountKobo"<>0)))
 THEN RAISE EXCEPTION 'Earlier possible funds or reversal need actual financial reconciliation; a later negative result cannot clear them'; END IF;
 RETURN actual;
END; $$;
