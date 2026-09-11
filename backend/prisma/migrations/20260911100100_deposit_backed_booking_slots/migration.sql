-- Durable, staff-bound availability and deposit-backed booking commitments.
CREATE TYPE "BookingSlotStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "BookingReminderKind" AS ENUM ('SEVEN_DAYS', 'THREE_DAYS', 'TWO_DAYS', 'ONE_DAY');
CREATE TYPE "BookingReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'CANCELLED', 'FAILED', 'DEAD_LETTER');
CREATE TYPE "BookingDisruptionResolution" AS ENUM ('PENDING', 'TRANSFERRED', 'REFUND_REQUESTED');

CREATE TABLE "BookingSlot" (
  "id" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "staffId" UUID NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" "BookingSlotStatus" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingSlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingSlot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingSlot_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BookingSlot_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aat_booking_slot_window_valid" CHECK ("endsAt" > "startsAt"),
  CONSTRAINT "aat_booking_slot_version_nonnegative" CHECK ("version" >= 0)
);

CREATE INDEX "BookingSlot_serviceId_branchId_status_startsAt_idx"
  ON "BookingSlot"("serviceId", "branchId", "status", "startsAt");
CREATE INDEX "BookingSlot_staffId_startsAt_endsAt_idx"
  ON "BookingSlot"("staffId", "startsAt", "endsAt");
CREATE INDEX "BookingSlot_status_startsAt_idx"
  ON "BookingSlot"("status", "startsAt");

ALTER TABLE "Booking"
  ADD COLUMN "bookingSlotId" UUID,
  ADD COLUMN "paymentHoldExpiresAt" TIMESTAMP(3),
  ADD COLUMN "depositBaseKobo" BIGINT,
  ADD COLUMN "depositBasisPoints" INTEGER,
  ADD COLUMN "depositAmountKobo" BIGINT,
  ADD COLUMN "depositPolicyVersion" VARCHAR(80),
  ADD COLUMN "depositTermsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "depositPaidAt" TIMESTAMP(3),
  ADD COLUMN "depositForfeitedAt" TIMESTAMP(3),
  ADD COLUMN "customerRescheduleCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scheduleVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "disruptionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "disruptionReason" TEXT,
  ADD COLUMN "disruptionResolution" "BookingDisruptionResolution",
  ADD CONSTRAINT "Booking_bookingSlotId_fkey" FOREIGN KEY ("bookingSlotId") REFERENCES "BookingSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "aat_booking_deposit_snapshot_complete" CHECK (
    "bookingSlotId" IS NULL OR (
      "branchId" IS NOT NULL
      AND "assignedStaffId" IS NOT NULL
      AND "depositBaseKobo" > 0
      AND "depositBasisPoints" = 3000
      AND "depositAmountKobo" = ("depositBaseKobo" * "depositBasisPoints" + 5000) / 10000
      AND "depositPolicyVersion" IS NOT NULL
      AND "depositTermsAcceptedAt" IS NOT NULL
      AND "paymentHoldExpiresAt" IS NOT NULL
      AND "paymentHoldExpiresAt" > "createdAt"
    )
  ),
  ADD CONSTRAINT "aat_booking_reschedule_count_valid" CHECK ("customerRescheduleCount" BETWEEN 0 AND 1),
  ADD CONSTRAINT "aat_booking_schedule_version_nonnegative" CHECK ("scheduleVersion" >= 0),
  ADD CONSTRAINT "aat_booking_deposit_timestamps_valid" CHECK (
    ("depositPaidAt" IS NULL OR "depositPaidAt" >= "createdAt")
    AND ("depositForfeitedAt" IS NULL OR "depositPaidAt" IS NOT NULL)
  ),
  ADD CONSTRAINT "aat_booking_disruption_complete" CHECK (
    ("disruptionRequestedAt" IS NULL AND "disruptionReason" IS NULL AND "disruptionResolution" IS NULL)
    OR ("disruptionRequestedAt" IS NOT NULL AND "disruptionReason" IS NOT NULL AND "disruptionResolution" IS NOT NULL)
  );

CREATE INDEX "Booking_bookingSlotId_status_idx" ON "Booking"("bookingSlotId", "status");
CREATE INDEX "Booking_status_paymentHoldExpiresAt_idx" ON "Booking"("status", "paymentHoldExpiresAt");
CREATE UNIQUE INDEX "BookingSlot_one_active_booking_idx"
  ON "Booking"("bookingSlotId")
  WHERE "bookingSlotId" IS NOT NULL AND "status" IN ('AWAITING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS');

CREATE TABLE "BookingReminder" (
  "id" UUID NOT NULL,
  "bookingId" UUID NOT NULL,
  "kind" "BookingReminderKind" NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "scheduleVersion" INTEGER NOT NULL,
  "status" "BookingReminderStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "lastErrorCode" VARCHAR(100),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingReminder_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "aat_booking_reminder_attempts_valid" CHECK ("attempts" BETWEEN 0 AND 20),
  CONSTRAINT "aat_booking_reminder_schedule_version_nonnegative" CHECK ("scheduleVersion" >= 0),
  CONSTRAINT "aat_booking_reminder_state_valid" CHECK (
    ("status" = 'SENT' AND "sentAt" IS NOT NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "sentAt" IS NULL)
    OR ("status" IN ('PENDING', 'PROCESSING', 'FAILED', 'DEAD_LETTER') AND "sentAt" IS NULL AND "cancelledAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "BookingReminder_bookingId_kind_scheduleVersion_key"
  ON "BookingReminder"("bookingId", "kind", "scheduleVersion");
CREATE INDEX "BookingReminder_status_nextAttemptAt_scheduledFor_idx"
  ON "BookingReminder"("status", "nextAttemptAt", "scheduledFor");
CREATE INDEX "BookingReminder_bookingId_scheduleVersion_idx"
  ON "BookingReminder"("bookingId", "scheduleVersion");

CREATE OR REPLACE FUNCTION aat_validate_booking_slot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  configured_duration INTEGER;
  configured_price BIGINT;
  configured_pricing "ServicePricingType";
  configured_currency CHAR(3);
  service_active BOOLEAN;
  staff_branch UUID;
  staff_status "UserStatus";
  branch_active BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('booking-slot-staff:' || NEW."staffId"::text, 0));

  SELECT s."durationMinutes", s."priceKobo", s."pricingType", s."currency", s."isActive"
    INTO configured_duration, configured_price, configured_pricing, configured_currency, service_active
    FROM "Service" s WHERE s."id" = NEW."serviceId" FOR SHARE;
  SELECT sp."branchId", u."status"
    INTO staff_branch, staff_status
    FROM "StaffProfile" sp JOIN "User" u ON u."id" = sp."userId"
    WHERE sp."id" = NEW."staffId" FOR SHARE OF sp, u;
  SELECT "isActive" INTO branch_active FROM "Branch" WHERE "id" = NEW."branchId" FOR SHARE;

  IF configured_duration IS NULL OR configured_price IS NULL OR configured_price <= 0
    OR configured_pricing <> 'FIXED' OR configured_currency <> 'NGN' OR service_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Only active fixed-price NGN services with duration can be published';
  END IF;
  IF staff_branch IS NULL OR staff_branch <> NEW."branchId" OR staff_status <> 'ACTIVE' OR branch_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Booking slot staff and branch are not eligible';
  END IF;
  IF NEW."endsAt" <> NEW."startsAt" + make_interval(mins => configured_duration) THEN
    RAISE EXCEPTION 'Booking slot duration must match the service duration';
  END IF;
  IF NEW."status" = 'OPEN' AND EXISTS (
    SELECT 1 FROM "BookingSlot" existing
    WHERE existing."staffId" = NEW."staffId"
      AND existing."id" <> NEW."id"
      AND existing."status" = 'OPEN'
      AND existing."startsAt" < NEW."endsAt"
      AND existing."endsAt" > NEW."startsAt"
  ) THEN
    RAISE EXCEPTION 'Booking slot overlaps another open slot for this staff member';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."serviceId" IS DISTINCT FROM OLD."serviceId"
    OR NEW."staffId" IS DISTINCT FROM OLD."staffId"
    OR NEW."startsAt" IS DISTINCT FROM OLD."startsAt"
    OR NEW."endsAt" IS DISTINCT FROM OLD."endsAt"
  ) AND EXISTS (SELECT 1 FROM "Booking" WHERE "bookingSlotId" = OLD."id") THEN
    RAISE EXCEPTION 'A used booking slot schedule is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "BookingSlot_validate"
BEFORE INSERT OR UPDATE ON "BookingSlot"
FOR EACH ROW EXECUTE FUNCTION aat_validate_booking_slot();

CREATE OR REPLACE FUNCTION aat_validate_booking_slot_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  slot_row "BookingSlot"%ROWTYPE;
BEGIN
  IF NEW."bookingSlotId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO slot_row FROM "BookingSlot" WHERE "id" = NEW."bookingSlotId" FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking slot does not exist';
  END IF;
  IF NEW."branchId" IS DISTINCT FROM slot_row."branchId"
    OR NEW."serviceId" IS DISTINCT FROM slot_row."serviceId"
    OR NEW."assignedStaffId" IS DISTINCT FROM slot_row."staffId"
    OR NEW."scheduledAt" IS DISTINCT FROM slot_row."startsAt" THEN
    RAISE EXCEPTION 'Booking schedule must match its published slot';
  END IF;
  IF TG_OP = 'INSERT' AND slot_row."status" <> 'OPEN' THEN
    RAISE EXCEPTION 'Booking slot is not open';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Booking_validate_slot_binding"
BEFORE INSERT OR UPDATE OF "bookingSlotId", "branchId", "serviceId", "assignedStaffId", "scheduledAt"
ON "Booking"
FOR EACH ROW EXECUTE FUNCTION aat_validate_booking_slot_binding();

ALTER TABLE "Payment"
  ADD COLUMN "bookingId" UUID,
  ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");

ALTER TABLE "Payment" DROP CONSTRAINT "aat_payment_exactly_one_target";
ALTER TABLE "Payment" DROP CONSTRAINT "aat_payment_purpose_matches_target";
ALTER TABLE "Payment"
  ADD CONSTRAINT "aat_payment_exactly_one_target"
  CHECK (num_nonnulls("orderId", "invoiceId", "vehicleTransactionId", "bookingId") = 1),
  ADD CONSTRAINT "aat_payment_purpose_matches_target"
  CHECK (
    ("purpose" = 'ORDER_PAYMENT' AND "orderId" IS NOT NULL AND num_nonnulls("invoiceId", "vehicleTransactionId", "bookingId") = 0)
    OR ("purpose" = 'SERVICE_INVOICE' AND "invoiceId" IS NOT NULL AND num_nonnulls("orderId", "vehicleTransactionId", "bookingId") = 0)
    OR ("purpose" = 'BOOKING_DEPOSIT' AND "bookingId" IS NOT NULL AND num_nonnulls("orderId", "invoiceId", "vehicleTransactionId") = 0)
    OR (
      "purpose" IN ('VEHICLE_RESERVATION', 'VEHICLE_PARTIAL_PAYMENT', 'VEHICLE_BALANCE_PAYMENT', 'VEHICLE_FULL_PAYMENT')
      AND "vehicleTransactionId" IS NOT NULL
      AND num_nonnulls("orderId", "invoiceId", "bookingId") = 0
    )
  );

CREATE OR REPLACE FUNCTION aat_freeze_payment_after_attempt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW."amountKobo" IS DISTINCT FROM OLD."amountKobo"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
    OR NEW."vehicleTransactionId" IS DISTINCT FROM OLD."vehicleTransactionId"
    OR NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
    OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
  ) AND EXISTS (SELECT 1 FROM "PaymentAttempt" WHERE "paymentId" = OLD."id" LIMIT 1) THEN
    RAISE EXCEPTION 'Payment amount and target are immutable after the first attempt';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_freeze_after_attempt" ON "Payment";
CREATE TRIGGER "Payment_freeze_after_attempt"
BEFORE UPDATE OF "amountKobo", "currency", "orderId", "invoiceId", "vehicleTransactionId", "bookingId", "purpose"
ON "Payment"
FOR EACH ROW EXECUTE FUNCTION aat_freeze_payment_after_attempt();

CREATE OR REPLACE FUNCTION aat_validate_payment_customer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_customer UUID;
BEGIN
  IF NEW."customerId" IS NULL THEN RETURN NEW; END IF;
  IF NEW."orderId" IS NOT NULL THEN
    SELECT "customerId" INTO target_customer FROM "Order" WHERE "id" = NEW."orderId";
  ELSIF NEW."invoiceId" IS NOT NULL THEN
    SELECT "customerId" INTO target_customer FROM "Invoice" WHERE "id" = NEW."invoiceId";
  ELSIF NEW."bookingId" IS NOT NULL THEN
    SELECT "customerId" INTO target_customer FROM "Booking" WHERE "id" = NEW."bookingId";
  ELSE
    SELECT "customerId" INTO target_customer FROM "VehicleTransaction" WHERE "id" = NEW."vehicleTransactionId";
  END IF;
  IF target_customer IS NOT NULL AND target_customer <> NEW."customerId" THEN
    RAISE EXCEPTION 'Payment customer does not own the payable target';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Payment_validate_customer" ON "Payment";
CREATE TRIGGER "Payment_validate_customer"
BEFORE INSERT OR UPDATE OF "customerId", "orderId", "invoiceId", "vehicleTransactionId", "bookingId"
ON "Payment"
FOR EACH ROW EXECUTE FUNCTION aat_validate_payment_customer();

ALTER TABLE "Invoice" ADD COLUMN "depositCreditKobo" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" DROP CONSTRAINT "aat_invoice_amounts_valid";
ALTER TABLE "Invoice"
  ADD CONSTRAINT "aat_invoice_amounts_valid" CHECK (
    "subtotalKobo" >= 0
    AND "taxKobo" >= 0
    AND "depositCreditKobo" >= 0
    AND "depositCreditKobo" <= "subtotalKobo" + "taxKobo"
    AND "totalKobo" = "subtotalKobo" + "taxKobo" - "depositCreditKobo"
  );

CREATE OR REPLACE FUNCTION aat_protect_issued_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" <> 'DRAFT' AND (
    NEW."customerId" IS DISTINCT FROM OLD."customerId"
    OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
    OR NEW."bookingId" IS DISTINCT FROM OLD."bookingId"
    OR NEW."vehicleTransactionId" IS DISTINCT FROM OLD."vehicleTransactionId"
    OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."subtotalKobo" IS DISTINCT FROM OLD."subtotalKobo"
    OR NEW."taxKobo" IS DISTINCT FROM OLD."taxKobo"
    OR NEW."depositCreditKobo" IS DISTINCT FROM OLD."depositCreditKobo"
    OR NEW."totalKobo" IS DISTINCT FROM OLD."totalKobo"
  ) THEN
    RAISE EXCEPTION 'Issued invoice amounts are immutable; void and replace it';
  END IF;
  RETURN NEW;
END;
$$;

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
    SELECT "customerId", "currency", "totalKobo", 0, 0, "totalKobo"
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
        AND (b."bookingSlotId" IS NULL OR (b."depositPaidAt" IS NOT NULL AND b."depositForfeitedAt" IS NULL));
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

DROP TRIGGER IF EXISTS "Invoice_validate_source_snapshot" ON "Invoice";
CREATE TRIGGER "Invoice_validate_source_snapshot"
BEFORE INSERT OR UPDATE OF "customerId", "orderId", "bookingId", "vehicleTransactionId", "currency", "subtotalKobo", "taxKobo", "depositCreditKobo", "totalKobo"
ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION aat_validate_invoice_source_snapshot();
