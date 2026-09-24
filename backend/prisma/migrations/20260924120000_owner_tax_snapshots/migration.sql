ALTER TABLE "Order" ADD COLUMN "taxKobo" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Order" DROP CONSTRAINT "aat_order_amounts_valid";
ALTER TABLE "Order" ADD CONSTRAINT "aat_order_amounts_valid" CHECK (
 "subtotalKobo" >= 0 AND "discountAmountKobo" >= 0 AND "discountAmountKobo" <= "subtotalKobo" AND "deliveryFeeKobo" >= 0 AND "taxKobo" >= 0
 AND "totalKobo" = "subtotalKobo" - "discountAmountKobo" + "deliveryFeeKobo" + "taxKobo");
CREATE OR REPLACE FUNCTION aat_validate_invoice_source_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_customer UUID;
  expected_currency CHAR(3);
  expected_subtotal BIGINT;
  expected_tax BIGINT;
  expected_credit BIGINT := 0;
  expected_total BIGINT;
  pending_refunds INTEGER := 0;
BEGIN
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "customerId", "currency", "totalKobo" - "taxKobo", "taxKobo", 0, "totalKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "Order" WHERE "id" = NEW."orderId";
  ELSIF NEW."bookingId" IS NOT NULL THEN
    SELECT b."customerId", q."currency", q."subtotalKobo", q."taxKobo",
      CASE WHEN b."bookingSlotId" IS NULL THEN 0 ELSE LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo") END,
      q."totalKobo" - CASE WHEN b."bookingSlotId" IS NULL THEN 0 ELSE LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo") END,
      COALESCE(refunds.pending, 0)
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total, pending_refunds
      FROM "Booking" b
      JOIN "ServiceQuote" q ON q."bookingId" = b."id" AND q."status" = 'ACCEPTED'
      LEFT JOIN "Payment" p ON p."bookingId" = b."id" AND p."status" = 'SUCCEEDED'
      LEFT JOIN (
        SELECT pa."paymentId",
          COALESCE(SUM(r."amountKobo") FILTER (WHERE r."status" = 'SUCCEEDED'), 0) AS refunded,
          COUNT(*) FILTER (WHERE r."status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')) AS pending
        FROM "PaymentAttempt" pa LEFT JOIN "Refund" r ON r."paymentAttemptId" = pa."id"
        GROUP BY pa."paymentId"
      ) refunds ON refunds."paymentId" = p."id"
      WHERE b."id" = NEW."bookingId"
        AND (b."bookingSlotId" IS NULL OR b."depositPolicyVersion" = 'owner-booking-request-v2' OR (b."depositPaidAt" IS NOT NULL AND b."depositForfeitedAt" IS NULL));
  ELSIF NEW."vehicleTransactionId" IS NOT NULL THEN
    SELECT "customerId", "currency", "agreedPriceKobo", 0, 0, "agreedPriceKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "VehicleTransaction" WHERE "id" = NEW."vehicleTransactionId";
  END IF;

  IF pending_refunds > 0 THEN
    RAISE EXCEPTION 'Invoice cannot snapshot a booking deposit while a refund is pending';
  END IF;
  IF expected_customer IS NULL
    OR expected_credit < 0
    OR NEW."customerId" IS DISTINCT FROM expected_customer
    OR NEW."currency" IS DISTINCT FROM expected_currency
    OR NEW."subtotalKobo" IS DISTINCT FROM expected_subtotal
    OR NEW."taxKobo" IS DISTINCT FROM expected_tax
    OR NEW."depositCreditKobo" IS DISTINCT FROM expected_credit
    OR NEW."totalKobo" IS DISTINCT FROM expected_total THEN
    RAISE EXCEPTION 'Invoice source, customer, currency, and amount snapshot must match server truth';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION aat_protect_policy_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD."policySnapshot" IS NOT NULL AND NEW."policySnapshot" IS DISTINCT FROM OLD."policySnapshot" THEN RAISE EXCEPTION 'Transaction policy snapshot is immutable'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER "Order_policy_snapshot_immutable" BEFORE UPDATE OF "policySnapshot" ON "Order" FOR EACH ROW EXECUTE FUNCTION aat_protect_policy_snapshot();
CREATE TRIGGER "Payment_policy_snapshot_immutable" BEFORE UPDATE OF "policySnapshot" ON "Payment" FOR EACH ROW EXECUTE FUNCTION aat_protect_policy_snapshot();
CREATE TRIGGER "Invoice_policy_snapshot_immutable" BEFORE UPDATE OF "policySnapshot" ON "Invoice" FOR EACH ROW EXECUTE FUNCTION aat_protect_policy_snapshot();
CREATE TRIGGER "ServiceQuote_policy_snapshot_immutable" BEFORE UPDATE OF "policySnapshot" ON "ServiceQuote" FOR EACH ROW EXECUTE FUNCTION aat_protect_policy_snapshot();
CREATE TRIGGER "VehicleTransaction_policy_snapshot_immutable" BEFORE UPDATE OF "policySnapshot" ON "VehicleTransaction" FOR EACH ROW EXECUTE FUNCTION aat_protect_policy_snapshot();
CREATE TRIGGER "Booking_policy_snapshot_immutable" BEFORE UPDATE OF "policySnapshot" ON "Booking" FOR EACH ROW EXECUTE FUNCTION aat_protect_policy_snapshot();
