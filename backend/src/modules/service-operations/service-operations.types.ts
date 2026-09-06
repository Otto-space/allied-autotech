export function page<T extends { id: string }>(rows: readonly T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : [...rows];
  const last = items.at(-1);
  return { items, ...(hasMore && last !== undefined ? { nextCursor: last.id } : {}) };
}

export interface PricedLine {
  type: "LABOUR" | "PART" | "FEE";
  productId: string | null;
  description: string;
  quantity: number;
  unitPriceKobo: bigint;
  subtotalKobo: bigint;
}
