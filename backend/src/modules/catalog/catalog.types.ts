export interface Page<T> {
  items: T[];
  nextCursor?: string;
}

export function page<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, ...(hasMore && last !== undefined ? { nextCursor: last.id } : {}) };
}
