import type { Prisma } from "../../generated/prisma/client.js";

export const activeCategoryWhere = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;
export const activeProductWhere = {
  isActive: true,
  category: activeCategoryWhere,
} satisfies Prisma.ProductWhereInput;
