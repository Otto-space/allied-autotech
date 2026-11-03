-- Forward-only refinement: status-only withdrawal preserves publication, schedule and history guards.
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
  -- Withdrawal changes availability only, never the stored schedule or estimates.
  IF TG_OP = 'UPDATE' AND NEW."status" = 'CLOSED'
    AND ROW(NEW."branchId", NEW."serviceId", NEW."staffId", NEW."startsAt", NEW."endsAt",
            NEW."durationMinutes", NEW."preparationMinutes", NEW."cleanupMinutes", NEW."serviceTimingVersion")
        IS NOT DISTINCT FROM
        ROW(OLD."branchId", OLD."serviceId", OLD."staffId", OLD."startsAt", OLD."endsAt",
            OLD."durationMinutes", OLD."preparationMinutes", OLD."cleanupMinutes", OLD."serviceTimingVersion")
  THEN
    RETURN NEW;
  END IF;
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
