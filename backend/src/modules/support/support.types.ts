export function supportPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, ...(rows.length > limit && last ? { nextCursor: last.id } : {}) };
}

export function supportMessagePage<T extends { id: string }>(
  rows: T[],
  limit: number,
  previousCursor?: string,
) {
  const items = rows.slice(0, limit);
  return {
    items,
    cursor: items.at(-1)?.id ?? previousCursor ?? null,
    hasMore: rows.length > limit,
    pollAfterMs: 5_000,
  };
}
