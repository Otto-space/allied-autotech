-- Add verified-purchase product reviews after PRODUCT is committed as an enum value.
ALTER TABLE "Review"
  ADD COLUMN "productId" UUID,
  ADD COLUMN "orderItemId" UUID;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Review_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Review_orderItemId_key" UNIQUE ("orderItemId");

CREATE INDEX "Review_productId_idx" ON "Review" ("productId");
CREATE UNIQUE INDEX "Review_customer_product_once_key"
  ON "Review" ("customerId", "productId")
  WHERE "targetType" = 'PRODUCT';

ALTER TABLE "Review" DROP CONSTRAINT "aat_review_target_valid";
ALTER TABLE "Review"
  ADD CONSTRAINT "aat_review_target_valid" CHECK (
    ("targetType" = 'BUSINESS' AND num_nonnulls("productId", "orderItemId", "serviceId", "bookingId", "orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'PRODUCT' AND "productId" IS NOT NULL AND "orderItemId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'SERVICE' AND "serviceId" IS NOT NULL AND "bookingId" IS NOT NULL AND num_nonnulls("productId", "orderItemId", "orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'ORDER' AND "orderId" IS NOT NULL AND num_nonnulls("productId", "orderItemId", "serviceId", "bookingId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'VEHICLE_TRANSACTION' AND "vehicleTransactionId" IS NOT NULL AND num_nonnulls("productId", "orderItemId", "serviceId", "bookingId", "orderId") = 0)
  );

CREATE OR REPLACE FUNCTION aat_validate_review_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  related_customer UUID;
  related_product UUID;
  related_service UUID;
  related_status TEXT;
BEGIN
  IF NEW."targetType" = 'PRODUCT' THEN
    SELECT o."customerId", oi."productId", o."status"::text
      INTO related_customer, related_product, related_status
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE oi."id" = NEW."orderItemId";
    IF related_customer IS DISTINCT FROM NEW."customerId"
       OR related_product IS DISTINCT FROM NEW."productId"
       OR related_status IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'review source is not an eligible completed product purchase'
        USING ERRCODE = '23514', CONSTRAINT = 'aat_review_source_eligible';
    END IF;
  ELSIF NEW."targetType" = 'SERVICE' THEN
    SELECT "customerId", "serviceId", "status"::text
      INTO related_customer, related_service, related_status
      FROM "Booking" WHERE "id" = NEW."bookingId";
    IF related_customer IS DISTINCT FROM NEW."customerId"
       OR related_service IS DISTINCT FROM NEW."serviceId"
       OR related_status IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'review source is not an eligible completed booking'
        USING ERRCODE = '23514', CONSTRAINT = 'aat_review_source_eligible';
    END IF;
  ELSIF NEW."targetType" = 'ORDER' THEN
    SELECT "customerId", "status"::text
      INTO related_customer, related_status
      FROM "Order" WHERE "id" = NEW."orderId";
    IF related_customer IS DISTINCT FROM NEW."customerId"
       OR related_status IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'review source is not an eligible completed order'
        USING ERRCODE = '23514', CONSTRAINT = 'aat_review_source_eligible';
    END IF;
  ELSIF NEW."targetType" = 'VEHICLE_TRANSACTION' THEN
    SELECT "customerId", "status"::text
      INTO related_customer, related_status
      FROM "VehicleTransaction" WHERE "id" = NEW."vehicleTransactionId";
    IF related_customer IS DISTINCT FROM NEW."customerId"
       OR related_status IS DISTINCT FROM 'COMPLETED' THEN
      RAISE EXCEPTION 'review source is not an eligible completed vehicle transaction'
        USING ERRCODE = '23514', CONSTRAINT = 'aat_review_source_eligible';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER "Review_source_eligible" ON "Review";
CREATE TRIGGER "Review_source_eligible"
BEFORE INSERT OR UPDATE OF "customerId", "targetType", "productId", "orderItemId", "serviceId", "bookingId", "orderId", "vehicleTransactionId"
ON "Review"
FOR EACH ROW EXECUTE FUNCTION aat_validate_review_eligibility();

CREATE OR REPLACE FUNCTION aat_preserve_review_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    OLD."customerId", OLD."targetType", OLD."productId", OLD."orderItemId",
    OLD."serviceId", OLD."bookingId", OLD."orderId", OLD."vehicleTransactionId",
    OLD."rating", OLD."title", OLD."comment"
  ) IS DISTINCT FROM ROW(
    NEW."customerId", NEW."targetType", NEW."productId", NEW."orderItemId",
    NEW."serviceId", NEW."bookingId", NEW."orderId", NEW."vehicleTransactionId",
    NEW."rating", NEW."title", NEW."comment"
  ) THEN
    RAISE EXCEPTION 'submitted review content and source are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'aat_review_submission_immutable';
  END IF;
  RETURN NEW;
END;
$$;
