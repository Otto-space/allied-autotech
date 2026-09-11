-- Aligns the new timestamps with Prisma's established PostgreSQL DateTime
-- mapping. This is forward-only because the preceding migration may already
-- be applied in development or staging review environments.

ALTER TABLE "PaymentAttempt"
  ALTER COLUMN "authorizationExpiresAt"
  TYPE TIMESTAMP(3) WITHOUT TIME ZONE
  USING "authorizationExpiresAt" AT TIME ZONE 'UTC';

ALTER TABLE "PaymentWebhookEvent"
  ALTER COLUMN "providerVerifiedAt"
  TYPE TIMESTAMP(3) WITHOUT TIME ZONE
  USING "providerVerifiedAt" AT TIME ZONE 'UTC';
