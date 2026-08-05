/**
 * Shared cursor-pagination helpers for the repository layer.
 * Cursor is the opaque row `id` (cuid); callers receive `nextCursor` to
 * pass back as `cursor`. `hasMore` is derived by fetching `take + 1` rows.
 */
export const MAX_PAGE_SIZE = 100;

export type PageParams = {
  cursor?: string;
  limit?: number;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export function normalizeLimit(limit?: number, fallback = 20): number {
  const n = Math.trunc(limit ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_PAGE_SIZE);
}

/** Prisma cursor+skip args for keyset pagination on `id`. */
export function idCursor(cursor?: string): { cursor?: { id: string }; skip?: number } {
  return cursor ? { cursor: { id: cursor }, skip: 1 } : {};
}

/** Splits `take + 1` fetched rows into a page + nextCursor. */
export function toPage<T extends { id: string }>(rows: T[], take: number): Page<T> {
  const hasMore = rows.length > take;
  const items = hasMore ? rows.slice(0, take) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.id : null, hasMore };
}
