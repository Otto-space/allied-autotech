import { describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
const runDatabaseTests = process.env.RUN_DATABASE_TESTS === "true";
describe.skipIf(!runDatabaseTests)("Phase 6 database controls", () => {
  it("installs concurrency, lookup, and immutable snapshot controls", async () => {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT conname AS name FROM pg_constraint WHERE conname IN ('aat_order_branch_required_for_new_rows','aat_order_confirmed_timestamp','aat_promotion_version_nonnegative','aat_invoice_version_nonnegative')
      UNION ALL SELECT indexname AS name FROM pg_indexes WHERE indexname IN ('Order_branchId_status_createdAt_idx','Order_pending_payment_due_idx','InventoryReservation_active_order_idx','PromotionUsage_promotionId_createdAt_idx')
      UNION ALL SELECT tgname AS name FROM pg_trigger WHERE tgname IN ('Order_protect_snapshot','OrderItem_forbid_update','PromotionUsage_forbid_mutation','Invoice_validate_source_snapshot') AND NOT tgisinternal`;
    expect(new Set(rows.map(({ name }) => name))).toEqual(
      new Set([
        "aat_order_branch_required_for_new_rows",
        "aat_order_confirmed_timestamp",
        "aat_promotion_version_nonnegative",
        "aat_invoice_version_nonnegative",
        "Order_branchId_status_createdAt_idx",
        "Order_pending_payment_due_idx",
        "InventoryReservation_active_order_idx",
        "PromotionUsage_promotionId_createdAt_idx",
        "Order_protect_snapshot",
        "OrderItem_forbid_update",
        "PromotionUsage_forbid_mutation",
        "Invoice_validate_source_snapshot",
      ]),
    );
    const obsolete = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM pg_constraint
      WHERE conname = 'Invoice_exactly_one_source'`;
    expect(obsolete[0]?.count).toBe(0n);
  }, 15_000);
});
