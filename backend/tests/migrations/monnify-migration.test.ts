import { describe, expect, it } from "vitest";

import { prisma } from "../../src/config/database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "secure Monnify migration",
  () => {
    it("installs encrypted checkout and webhook verification controls", async () => {
      const columns = await prisma.$queryRaw<
        Array<{ table_name: string; column_name: string; is_nullable: string }>
      >`
        SELECT table_name, column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN (
            ('PaymentAttempt', 'encryptedCheckoutState'),
            ('PaymentAttempt', 'authorizationExpiresAt'),
            ('PaymentWebhookEvent', 'providerVerifiedAt'),
            ('PaymentWebhookEvent', 'signatureVerifiedAt')
          )
        ORDER BY table_name, column_name`;
      expect(columns).toHaveLength(4);
      expect(
        columns.find(({ column_name }) => column_name === "signatureVerifiedAt")
          ?.is_nullable,
      ).toBe("YES");
      const controls = await prisma.$queryRaw<Array<{ name: string }>>`
        SELECT conname AS name FROM pg_constraint
        WHERE conname IN (
          'aat_payment_attempt_checkout_expiry_pair',
          'aat_payment_attempt_checkout_state_object',
          'aat_webhook_event_verification_required'
        )
        UNION ALL
        SELECT indexname AS name FROM pg_indexes
        WHERE indexname = 'PaymentAttempt_provider_status_initiatedAt_idx'`;
      expect(controls.map(({ name }) => name).sort()).toEqual([
        "PaymentAttempt_provider_status_initiatedAt_idx",
        "aat_payment_attempt_checkout_expiry_pair",
        "aat_payment_attempt_checkout_state_object",
        "aat_webhook_event_verification_required",
      ]);
    });
  },
);
