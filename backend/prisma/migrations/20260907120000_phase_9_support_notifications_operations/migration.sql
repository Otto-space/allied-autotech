-- Phase 9 adds support-message history, review moderation accountability,
-- notification preferences/delivery state, and branch-scoped support queues.
-- Existing migrations are intentionally left unchanged.

CREATE TYPE "NotificationCategory" AS ENUM (
  'SECURITY',
  'TRANSACTIONAL',
  'OPERATIONAL',
  'MARKETING'
);

CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

CREATE TYPE "SupportMessageVisibility" AS ENUM ('CUSTOMER', 'INTERNAL');

CREATE TYPE "SupportMessageAuthorType" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

ALTER TABLE "Review"
  ADD COLUMN "moderatedByUserId" UUID,
  ADD COLUMN "moderationNote" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- The initial and phase-2 target checks conflict for service reviews and the
-- initial check predates vehicle transactions. Replace both with one rule.
ALTER TABLE "Review"
  DROP CONSTRAINT IF EXISTS "Review_target_consistent",
  DROP CONSTRAINT IF EXISTS "aat_review_target_valid",
  DROP CONSTRAINT IF EXISTS "Review_rating_range";

ALTER TABLE "Review"
  ADD CONSTRAINT "aat_review_target_valid" CHECK (
    ("targetType" = 'BUSINESS' AND num_nonnulls("serviceId", "bookingId", "orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'SERVICE' AND "serviceId" IS NOT NULL AND "bookingId" IS NOT NULL AND num_nonnulls("orderId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'ORDER' AND "orderId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "vehicleTransactionId") = 0)
    OR ("targetType" = 'VEHICLE_TRANSACTION' AND "vehicleTransactionId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "orderId") = 0)
  ),
  ADD CONSTRAINT "aat_review_moderation_valid" CHECK (
    ("status" = 'PENDING' AND "moderatedByUserId" IS NULL AND "moderatedAt" IS NULL)
    OR ("status" = 'APPROVED' AND "moderatedByUserId" IS NOT NULL AND "moderatedAt" IS NOT NULL)
    OR ("status" = 'REJECTED' AND "moderatedByUserId" IS NOT NULL AND "moderatedAt" IS NOT NULL AND nullif(btrim("moderationNote"), '') IS NOT NULL)
  ),
  ADD CONSTRAINT "aat_review_version_nonnegative" CHECK ("version" >= 0);

CREATE INDEX "Review_moderatedByUserId_idx" ON "Review" ("moderatedByUserId");

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_moderatedByUserId_fkey"
  FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION aat_validate_review_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  related_customer UUID;
  related_service UUID;
  related_status TEXT;
BEGIN
  IF NEW."targetType" = 'SERVICE' THEN
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

CREATE TRIGGER "Review_source_eligible"
BEFORE INSERT OR UPDATE OF "customerId", "targetType", "serviceId", "bookingId", "orderId", "vehicleTransactionId"
ON "Review"
FOR EACH ROW EXECUTE FUNCTION aat_validate_review_eligibility();

CREATE OR REPLACE FUNCTION aat_preserve_review_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(
    OLD."customerId", OLD."targetType", OLD."serviceId", OLD."bookingId",
    OLD."orderId", OLD."vehicleTransactionId", OLD."rating", OLD."title", OLD."comment"
  ) IS DISTINCT FROM ROW(
    NEW."customerId", NEW."targetType", NEW."serviceId", NEW."bookingId",
    NEW."orderId", NEW."vehicleTransactionId", NEW."rating", NEW."title", NEW."comment"
  ) THEN
    RAISE EXCEPTION 'submitted review content and source are immutable'
      USING ERRCODE = '23514', CONSTRAINT = 'aat_review_submission_immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Review_submission_immutable"
BEFORE UPDATE ON "Review"
FOR EACH ROW EXECUTE FUNCTION aat_preserve_review_source();

ALTER TABLE "Enquiry" DROP CONSTRAINT IF EXISTS "aat_enquiry_target_valid";

ALTER TABLE "Enquiry"
  ADD COLUMN "branchId" UUID,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Complaint"
  ADD COLUMN "branchId" UUID,
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- Preserve existing records by deriving a branch from their referenced source.
UPDATE "Enquiry" e
SET "branchId" = COALESCE(
  (SELECT b."branchId" FROM "Booking" b WHERE b."id" = e."bookingId"),
  (SELECT b."branchId" FROM "ServiceQuote" q JOIN "Booking" b ON b."id" = q."bookingId" WHERE q."id" = e."quoteId"),
  (SELECT vl."branchId" FROM "VehicleListing" vl WHERE vl."id" = e."vehicleListingId"),
  CASE
    WHEN (SELECT count(*) FROM "Branch" WHERE "isActive" = true) = 1
    THEN (SELECT br."id" FROM "Branch" br WHERE br."isActive" = true ORDER BY br."id" LIMIT 1)
    ELSE NULL
  END
);

UPDATE "Complaint" c
SET "branchId" = COALESCE(
  (SELECT b."branchId" FROM "Booking" b WHERE b."id" = c."bookingId"),
  (SELECT o."branchId" FROM "Order" o WHERE o."id" = c."orderId"),
  (SELECT vl."branchId" FROM "VehicleTransaction" vt JOIN "VehicleListing" vl ON vl."id" = vt."vehicleListingId" WHERE vt."id" = c."vehicleTransactionId"),
  CASE
    WHEN (SELECT count(*) FROM "Branch" WHERE "isActive" = true) = 1
    THEN (SELECT br."id" FROM "Branch" br WHERE br."isActive" = true ORDER BY br."id" LIMIT 1)
    ELSE NULL
  END
);

ALTER TABLE "Enquiry"
  ADD CONSTRAINT "Enquiry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "aat_enquiry_version_nonnegative" CHECK ("version" >= 0),
  ADD CONSTRAINT "aat_enquiry_target_valid" CHECK (
    ("type" = 'GENERAL' AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'PRODUCT' AND "productId" IS NOT NULL AND num_nonnulls("serviceId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'VEHICLE' AND "vehicleListingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "quoteId") = 0)
    OR ("type" = 'SERVICE' AND "serviceId" IS NOT NULL AND num_nonnulls("productId", "bookingId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'BOOKING' AND "customerId" IS NOT NULL AND "bookingId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "quoteId", "vehicleListingId") = 0)
    OR ("type" = 'QUOTATION' AND "customerId" IS NOT NULL AND "quoteId" IS NOT NULL AND num_nonnulls("productId", "serviceId", "bookingId", "vehicleListingId") = 0)
  ),
  ADD CONSTRAINT "aat_enquiry_status_timestamps" CHECK (
    ("status" IN ('OPEN', 'IN_PROGRESS') AND "resolvedAt" IS NULL AND "closedAt" IS NULL)
    OR ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL AND "closedAt" IS NULL)
    OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL)
  );

ALTER TABLE "Complaint"
  ADD CONSTRAINT "Complaint_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "aat_complaint_version_nonnegative" CHECK ("version" >= 0),
  ADD CONSTRAINT "aat_complaint_anonymous_contact" CHECK (
    "customerId" IS NOT NULL OR (nullif(btrim("name"), '') IS NOT NULL AND "email" IS NOT NULL)
  ),
  ADD CONSTRAINT "aat_complaint_source_count" CHECK (num_nonnulls("bookingId", "orderId", "vehicleTransactionId") <= 1),
  ADD CONSTRAINT "aat_complaint_status_timestamps" CHECK (
    ("status" IN ('OPEN', 'INVESTIGATING') AND "resolvedAt" IS NULL AND "closedAt" IS NULL)
    OR ("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL AND "closedAt" IS NULL AND nullif(btrim("resolution"), '') IS NOT NULL)
    OR ("status" = 'CLOSED' AND "closedAt" IS NOT NULL)
  );

CREATE INDEX "Enquiry_branchId_status_createdAt_idx" ON "Enquiry"("branchId", "status", "createdAt");
CREATE INDEX "Complaint_branchId_status_priority_createdAt_idx" ON "Complaint"("branchId", "status", "priority", "createdAt");

CREATE TABLE "SupportMessage" (
  "id" UUID NOT NULL,
  "enquiryId" UUID,
  "complaintId" UUID,
  "authorUserId" UUID,
  "authorType" "SupportMessageAuthorType" NOT NULL,
  "visibility" "SupportMessageVisibility" NOT NULL DEFAULT 'CUSTOMER',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aat_support_message_target" CHECK (num_nonnulls("enquiryId", "complaintId") = 1),
  CONSTRAINT "aat_support_message_author" CHECK (
    ("authorType" = 'SYSTEM' AND "authorUserId" IS NULL)
    OR ("authorType" IN ('CUSTOMER', 'STAFF') AND "authorUserId" IS NOT NULL)
  ),
  CONSTRAINT "aat_support_message_body" CHECK (char_length(btrim("body")) BETWEEN 1 AND 4000)
);

ALTER TABLE "SupportMessage"
  ADD CONSTRAINT "SupportMessage_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "Enquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupportMessage_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SupportMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SupportMessage_enquiryId_createdAt_idx" ON "SupportMessage"("enquiryId", "createdAt");
CREATE INDEX "SupportMessage_complaintId_createdAt_idx" ON "SupportMessage"("complaintId", "createdAt");
CREATE INDEX "SupportMessage_authorUserId_idx" ON "SupportMessage"("authorUserId");

CREATE TRIGGER "SupportMessage_append_only"
BEFORE UPDATE OR DELETE ON "SupportMessage"
FOR EACH ROW EXECUTE FUNCTION aat_forbid_update_or_delete();

ALTER TABLE "Notification"
  ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'TRANSACTIONAL',
  ADD COLUMN "resourceType" VARCHAR(80),
  ADD COLUMN "resourceId" VARCHAR(120),
  ADD COLUMN "deduplicationKey" VARCHAR(160);

CREATE UNIQUE INDEX "Notification_deduplicationKey_key" ON "Notification"("deduplicationKey");
CREATE INDEX "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "consentedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aat_notification_preference_scope" CHECK (
    "category" IN ('OPERATIONAL', 'MARKETING') AND "channel" IN ('EMAIL', 'SMS')
  ),
  CONSTRAINT "aat_notification_marketing_consent" CHECK (
    "category" <> 'MARKETING' OR "enabled" = false OR "consentedAt" IS NOT NULL
  )
);

ALTER TABLE "NotificationPreference"
  ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NotificationPreference_userId_category_channel_key"
  ON "NotificationPreference"("userId", "category", "channel");
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "outboxEventId" UUID,
  "channel" "NotificationChannel" NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" VARCHAR(100),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aat_notification_delivery_channel" CHECK ("channel" IN ('EMAIL', 'SMS')),
  CONSTRAINT "aat_notification_delivery_attempts" CHECK ("attempts" >= 0),
  CONSTRAINT "aat_notification_delivery_state" CHECK (
    ("status" = 'PUBLISHED' AND "deliveredAt" IS NOT NULL)
    OR ("status" <> 'PUBLISHED' AND "deliveredAt" IS NULL)
  )
);

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "NotificationDelivery_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "OutboxEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NotificationDelivery_outboxEventId_key" ON "NotificationDelivery"("outboxEventId");
CREATE UNIQUE INDEX "NotificationDelivery_notificationId_channel_key" ON "NotificationDelivery"("notificationId", "channel");
CREATE INDEX "NotificationDelivery_status_createdAt_idx" ON "NotificationDelivery"("status", "createdAt");
