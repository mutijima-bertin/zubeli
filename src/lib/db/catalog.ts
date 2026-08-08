/**
 * Shared catalog filter predicates — the single WHERE builder used by BOTH
 * the storefront product list (listPublished) and the category sidebar counts
 * (listAll), so counts always reflect the currently applied search/price/
 * availability filters. Pure query-shape logic, no DB access — unit-testable.
 */
import { Prisma } from "@prisma/client";
import type { AvailabilityFilter } from "@/types/api";

export const LOW_STOCK_MAX = 5;

export type CatalogSearchParams = {
  /** Multi-field: product name OR description OR category name (ILIKE, %-escaped). */
  search?: string;
  categorySlug?: string;
  /** Applied as `priceCents >= minPriceCents` — whole RWF units (ADR 0004: 1 RWF = 1 unit; identity with URL params). */
  minPriceCents?: number;
  /** Applied as `priceCents <= maxPriceCents` — whole RWF units (ADR 0004; identity with URL params). */
  maxPriceCents?: number;
  /** Availability bucket derived from `stockQty` (in > 0, low 1–5, out = 0). */
  stock?: AvailabilityFilter;
};

/**
 * Escapes LIKE wildcards so user input matches literally. Prisma passes
 * `contains` straight into Postgres ILIKE without escaping, so `%`/`_`/`\`
 * in a search string would act as wildcards — escape with the Postgres
 * default escape char (`\`).
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Published-scope-unaware WHERE fragment — callers add isPublished/deletedAt. */
export function catalogWhere(params: CatalogSearchParams): Prisma.ProductWhereInput {
  const { search, categorySlug, minPriceCents, maxPriceCents, stock } = params;
  const where: Prisma.ProductWhereInput = {};

  if (categorySlug) where.category = { slug: categorySlug };

  if (search) {
    const pattern = escapeLike(search);
    where.OR = [
      { name: { contains: pattern, mode: "insensitive" } },
      { description: { contains: pattern, mode: "insensitive" } },
      { category: { name: { contains: pattern, mode: "insensitive" } } },
    ];
  }

  if (minPriceCents !== undefined || maxPriceCents !== undefined) {
    const price: Prisma.IntFilter = {};
    if (minPriceCents !== undefined) price.gte = minPriceCents;
    if (maxPriceCents !== undefined) price.lte = maxPriceCents;
    where.priceCents = price;
  }

  if (stock === "in") where.stockQty = { gt: 0 };
  else if (stock === "low") where.stockQty = { gte: 1, lte: LOW_STOCK_MAX };
  else if (stock === "out") where.stockQty = 0;

  return where;
}