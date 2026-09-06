import { describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Phase 8 database controls",
  () => {
    it("installs financial evidence and webhook immutability controls", async () => {
      const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT tgname AS name FROM pg_trigger
      WHERE tgname IN (
        'ManualPaymentReview_protect_terminal',
        'Refund_protect_approved_identity',
        'PaymentWebhookEvent_protect_identity',
        'PaymentDispute_protect_identity',
        'PaymentLedgerEntry_append_only'
      ) AND NOT tgisinternal
      UNION ALL
      SELECT indexname AS name FROM pg_indexes
      WHERE indexname IN ('Refund_provider_work_idx', 'PaymentWebhookEvent_retry_claim_idx')`;
      expect(new Set(rows.map(({ name }) => name))).toEqual(
        new Set([
          "ManualPaymentReview_protect_terminal",
          "Refund_protect_approved_identity",
          "PaymentWebhookEvent_protect_identity",
          "PaymentDispute_protect_identity",
          "PaymentLedgerEntry_append_only",
          "Refund_provider_work_idx",
          "PaymentWebhookEvent_retry_claim_idx",
        ]),
      );
    });
  },
);
