-- Forward-only invoice snapshot reconciliation. Preserve the established
-- order, supplemental invoice, vehicle and historical booking source rules.
-- A new 20% booking deposit does not require an old published slot identity,
-- but does require an allocated, non-forfeited deposit and the exact quote sum.
CREATE OR REPLACE FUNCTION aat_validate_invoice_source_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_customer UUID;
  expected_guest UUID;
  expected_currency CHAR(3);
  expected_subtotal BIGINT;
  expected_tax BIGINT;
  expected_credit BIGINT := 0;
  expected_total BIGINT;
  pending_refunds INTEGER := 0;
BEGIN
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "customerId", "guestId", "currency", "totalKobo" - "taxKobo", "taxKobo", 0, "totalKobo"
      INTO expected_customer, expected_guest, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "Order" WHERE "id" = NEW."orderId";
  ELSIF NEW."bookingId" IS NOT NULL THEN
    -- Do not silently turn a paid-but-stale 20% deposit into zero credit.
    -- The application rejects this mismatch too; direct database writes must
    -- fail closed rather than generate an invoice that charges the full amount.
    IF EXISTS (
      SELECT 1 FROM "Booking" b
      JOIN LATERAL (
        SELECT q."totalKobo" FROM "ServiceQuote" q
        WHERE q."bookingId" = b."id"
          AND q."status" = 'ACCEPTED'
          AND q."originalInvoiceId" IS NULL
        ORDER BY q."version" DESC LIMIT 1
      ) q ON TRUE
      WHERE b."id" = NEW."bookingId"
        AND b."depositPolicyVersion" = 'approved-quote-deposit-20-v1'
        AND b."depositPaidAt" IS NOT NULL
        AND (
          b."depositBaseKobo" IS DISTINCT FROM q."totalKobo"
          OR b."depositBasisPoints" IS DISTINCT FROM 2000
          OR b."depositAmountKobo" IS DISTINCT FROM (q."totalKobo" * 2000 + 5000) / 10000
          OR b."depositForfeitedAt" IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM "Payment" p
            WHERE p."bookingId" = b."id" AND p."status" = 'SUCCEEDED'
          )
        )
    ) THEN
      RAISE EXCEPTION 'Paid booking deposit and accepted quotation are inconsistent';
    END IF;
    SELECT b."customerId", q."currency", q."subtotalKobo", q."taxKobo",
      CASE
        WHEN b."depositPolicyVersion" = 'approved-quote-deposit-20-v1'
          AND p."id" IS NOT NULL
          AND b."depositPaidAt" IS NOT NULL
          AND b."depositForfeitedAt" IS NULL
          AND b."depositBaseKobo" = q."totalKobo"
          AND b."depositBasisPoints" = 2000
          AND b."depositAmountKobo" = (q."totalKobo" * 2000 + 5000) / 10000
          THEN LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo")
        WHEN b."depositPolicyVersion" = 'approved-quote-deposit-20-v1' THEN 0
        WHEN b."bookingSlotId" IS NULL THEN 0
        ELSE LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo")
      END,
      q."totalKobo" - CASE
        WHEN b."depositPolicyVersion" = 'approved-quote-deposit-20-v1'
          AND p."id" IS NOT NULL
          AND b."depositPaidAt" IS NOT NULL
          AND b."depositForfeitedAt" IS NULL
          AND b."depositBaseKobo" = q."totalKobo"
          AND b."depositBasisPoints" = 2000
          AND b."depositAmountKobo" = (q."totalKobo" * 2000 + 5000) / 10000
          THEN LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo")
        WHEN b."depositPolicyVersion" = 'approved-quote-deposit-20-v1' THEN 0
        WHEN b."bookingSlotId" IS NULL THEN 0
        ELSE LEAST(COALESCE(b."depositAmountKobo", 0) - COALESCE(refunds.refunded, 0), q."totalKobo")
      END,
      COALESCE(refunds.pending, 0)
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total, pending_refunds
      FROM "Booking" b
      JOIN "ServiceQuote" q ON q."bookingId" = b."id" AND q."status" = 'ACCEPTED' AND q."originalInvoiceId" IS NULL
      LEFT JOIN "Payment" p ON p."bookingId" = b."id" AND p."status" = 'SUCCEEDED'
      LEFT JOIN (
        SELECT pa."paymentId",
          COALESCE(SUM(r."amountKobo") FILTER (WHERE r."status" = 'SUCCEEDED'), 0) AS refunded,
          COUNT(*) FILTER (WHERE r."status" NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED')) AS pending
        FROM "PaymentAttempt" pa LEFT JOIN "Refund" r ON r."paymentAttemptId" = pa."id"
        GROUP BY pa."paymentId"
      ) refunds ON refunds."paymentId" = p."id"
      WHERE b."id" = NEW."bookingId"
        AND (b."bookingSlotId" IS NULL OR b."depositPolicyVersion" = 'owner-booking-request-v2' OR (b."depositPaidAt" IS NOT NULL AND b."depositForfeitedAt" IS NULL))
      ORDER BY q."version" DESC LIMIT 1;
  ELSIF NEW."additionalQuoteId" IS NOT NULL THEN
    SELECT b."customerId", q."currency", q."subtotalKobo", q."taxKobo", 0, q."totalKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "ServiceQuote" q JOIN "Booking" b ON b."id"=q."bookingId"
      JOIN "Invoice" original ON original."id"=q."originalInvoiceId" AND original."bookingId"=b."id"
      JOIN "CustomerProfile" c ON c."id"=b."customerId"
      WHERE q."id"=NEW."additionalQuoteId" AND q."status"='ACCEPTED' AND q."acceptedAt" IS NOT NULL
      AND original."status" IN ('ISSUED','PAID') AND b."status"<>'CANCELLED'
      AND q."acceptedAdditionalContext" = jsonb_build_object('kind','ADDITIONAL_WORK',
        'invoiceNumber',original."invoiceNumber",'quoteVersion',q."version",
        'reason',q."amendmentReason",'customerUserId',c."userId");
  ELSIF NEW."vehicleTransactionId" IS NOT NULL THEN
    SELECT "customerId", "currency", "agreedPriceKobo", 0, 0, "agreedPriceKobo"
      INTO expected_customer, expected_currency, expected_subtotal, expected_tax, expected_credit, expected_total
      FROM "VehicleTransaction" WHERE "id" = NEW."vehicleTransactionId";
  END IF;

  IF pending_refunds > 0 THEN
    RAISE EXCEPTION 'Invoice cannot snapshot a booking deposit while a refund is pending';
  END IF;
  IF num_nonnulls(expected_customer, expected_guest) <> 1
    OR expected_credit < 0
    OR NEW."customerId" IS DISTINCT FROM expected_customer
    OR NEW."guestId" IS DISTINCT FROM expected_guest
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
