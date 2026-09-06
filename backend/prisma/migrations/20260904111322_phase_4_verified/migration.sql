-- Align the manually created branch-pagination index name with Prisma's
-- deterministic schema-generated name. Index contents are unchanged.
ALTER INDEX "Inventory_branch_id_idx" RENAME TO "Inventory_branchId_id_idx";
