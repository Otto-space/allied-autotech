export interface CursorPage<T> {
  items: readonly T[];
  nextCursor?: string;
}
