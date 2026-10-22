CREATE TYPE "SupportMessageKind" AS ENUM ('LEGACY', 'REPLY', 'INTERNAL_NOTE', 'STATUS_CHANGE');
ALTER TABLE "SupportMessage"
  ADD COLUMN "kind" "SupportMessageKind" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "fromStatus" VARCHAR(32),
  ADD COLUMN "toStatus" VARCHAR(32);
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_event_shape_check" CHECK (
  ("kind" = 'STATUS_CHANGE' AND "authorType" = 'STAFF' AND "visibility" = 'CUSTOMER'
    AND "fromStatus" IS NOT NULL AND "toStatus" IS NOT NULL AND "fromStatus" <> "toStatus"
    AND (("enquiryId" IS NOT NULL AND "fromStatus" IN ('OPEN','IN_PROGRESS','RESOLVED') AND "toStatus" IN ('IN_PROGRESS','RESOLVED','CLOSED'))
      OR ("complaintId" IS NOT NULL AND "fromStatus" IN ('OPEN','INVESTIGATING','RESOLVED') AND "toStatus" IN ('INVESTIGATING','RESOLVED','CLOSED'))))
  OR ("kind" <> 'STATUS_CHANGE' AND "fromStatus" IS NULL AND "toStatus" IS NULL
    AND ("kind" = 'LEGACY' OR ("kind" = 'REPLY' AND "visibility" = 'CUSTOMER') OR ("kind" = 'INTERNAL_NOTE' AND "visibility" = 'INTERNAL' AND "authorType" = 'STAFF')))
);
ALTER TABLE "Notification" ADD COLUMN "supportMessageId" UUID;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_supportMessageId_fkey"
  FOREIGN KEY ("supportMessageId") REFERENCES "SupportMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Notification_supportMessageId_idx" ON "Notification"("supportMessageId");
