-- Align the promotion-usage composite index name with the Prisma schema.
ALTER INDEX "PromotionUsage_promotion_createdAt_idx"
  RENAME TO "PromotionUsage_promotionId_createdAt_idx";
