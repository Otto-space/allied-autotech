import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    "prisma/migrations/20260907120000_phase_9_support_notifications_operations/migration.sql",
  ),
  "utf8",
);
const productEnumMigration = readFileSync(
  resolve("prisma/migrations/20260910100000_add_product_review_target/migration.sql"),
  "utf8",
);
const productReviewMigration = readFileSync(
  resolve("prisma/migrations/20260910101000_product_reviews/migration.sql"),
  "utf8",
);

describe("Phase 9 migration controls", () => {
  it("replaces conflicting review rules with one eligible-target contract", () => {
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "Review_target_consistent"');
    expect(migration).toContain('DROP CONSTRAINT IF EXISTS "aat_review_target_valid"');
    expect(migration).toContain("aat_validate_review_eligibility");
    expect(migration).toContain("aat_review_submission_immutable");
  });

  it("makes support history append-only and constrains notification preferences", () => {
    expect(migration).toContain('TRIGGER "SupportMessage_append_only"');
    expect(migration).toContain("aat_notification_preference_scope");
    expect(migration).toContain("aat_notification_delivery_channel");
  });

  it("commits the product-review enum before using it in review constraints", () => {
    expect(productEnumMigration).toContain("ADD VALUE IF NOT EXISTS 'PRODUCT'");
    expect(productEnumMigration).not.toContain("CHECK (");
    expect(productReviewMigration).toContain("Review_customer_product_once_key");
    expect(productReviewMigration).toContain("eligible completed product purchase");
    expect(productReviewMigration).toContain('OLD."productId"');
  });
});
