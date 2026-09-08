export function supportPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, ...(rows.length > limit && last ? { nextCursor: last.id } : {}) };
}
