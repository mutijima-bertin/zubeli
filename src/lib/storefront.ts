/**
 * Storefront server-side data helpers — the ONLY data access layer screen
 * agents import (SCREENS.md). Thin glue over the database-agent repos +
 * DTO mappers; pages never import src/lib/db/* directly.
 *
 * Server-only: never import from a client component.
 */
import "server-only";
import { listAll, type CategoryWithCount } from "@/lib/db/categories";
import { getBySlug, getFeatured, listPublished, type ProductSort } from "@/lib/db/products";
import { toProductCardDTO, toProductDTO } from "@/lib/dto";
import { siteConfig } from "@/lib/site";
import type { AvailabilityFilter, CatalogFilter, Page, ProductCardDTO, ProductDTO } from "@/types/api";

export const CATALOG_PAGE_SIZE = 20;

const VALID_SORTS = new Set<ProductSort>(["newest", "price-asc", "price-desc", "featured"]);
const VALID_AVAIL = new Set<AvailabilityFilter>(["in", "low", "out"]);

function normalizeSort(raw: string | null | undefined): ProductSort {
  return raw && VALID_SORTS.has(raw as ProductSort) ? (raw as ProductSort) : "newest";
}

function normalizeAvail(raw: string | null | undefined): AvailabilityFilter | null {
  return raw && VALID_AVAIL.has(raw as AvailabilityFilter) ? (raw as AvailabilityFilter) : null;
}

/**
 * Parses a user-facing RWF price search param. RWF amounts are integers and
 * `priceCents` stores whole RWF (1 RWF = 1 unit — ADR 0004, format.ts), so
 * the URL value maps IDENTITY to the DB filter, no scaling — any non-numeric,
 * negative, decimal or non-safe input is treated as ABSENT (never 500).
 */
function parsePriceRwf(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export type { CatalogFilter } from "@/types/api";

export type HomepageData = {
  featured: ProductCardDTO[];
  categories: CategoryWithCount[];
  deliveryFeeCents: number;
};

/** Home sections: featured products + category counts (delivery fee for banners). */
export async function getHomepageData(): Promise<HomepageData> {
  const [featured, categories] = await Promise.all([getFeatured(8), listAll()]);
  return {
    featured: featured.map(toProductCardDTO),
    categories,
    deliveryFeeCents: siteConfig.deliveryFeeCents,
  };
}

export type CatalogPageData = {
  page: Page<ProductCardDTO>;
  categories: CategoryWithCount[];
  /** Echo of the applied filters — drives filter UI, link-building + "showing X of" copy. */
  filter: CatalogFilter;
};

/**
 * Catalog page (list + filter echo). Cursor pagination per ADR 0004 —
 * filter/sort changes must reset the cursor (contract in the build plan).
 *
 * New additive filters (2026-08-08):
 * - `q` — multi-field search: name OR description OR category name (ILIKE).
 * - `minPrice`/`maxPrice` — RWF integer bounds from searchParams (parsed
 *   here, invalid input treated as absent; identity mapping to priceCents —
 *   1 RWF = 1 stored unit, ADR 0004 — NO ×100 scaling).
 * - `avail` — `in` (stockQty > 0) | `low` (1–5) | `out` (= 0); anything
 *   outside the enum treated as absent.
 * Category counts reflect q/minPrice/maxPrice/avail (not `cat` itself).
 */
export async function getCatalogPage(params: {
  q?: string;
  cat?: string;
  sort?: string;
  cursor?: string;
  minPrice?: string;
  maxPrice?: string;
  avail?: string;
}): Promise<CatalogPageData> {
  const { q, cat, cursor } = params;
  const sort = normalizeSort(params.sort);
  const minPrice = parsePriceRwf(params.minPrice);
  const maxPrice = parsePriceRwf(params.maxPrice);
  const avail = normalizeAvail(params.avail);

  const listFilters = {
    search: q || undefined,
    // Identity: priceCents stores whole RWF (ADR 0004) — URL RWF int == DB unit.
    minPriceCents: minPrice ?? undefined,
    maxPriceCents: maxPrice ?? undefined,
    stock: avail ?? undefined,
  };

  const [result, categories] = await Promise.all([
    listPublished({
      ...listFilters,
      categorySlug: cat || undefined,
      sort,
      cursor,
      limit: CATALOG_PAGE_SIZE,
    }),
    listAll(listFilters),
  ]);
  return {
    page: {
      items: result.items.map(toProductCardDTO),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
    categories,
    filter: { q: q ?? null, cat: cat ?? null, sort, minPrice, maxPrice, avail },
  };
}

/**
 * Product detail — null for unpublished/soft-deleted slugs → screens call
 * `notFound()` (repo already filters isPublished / deletedAt).
 */
export async function getProductDetail(slug: string): Promise<ProductDTO | null> {
  const product = await getBySlug(slug);
  return product ? toProductDTO(product) : null;
}

/**
 * Related products: same category first (self excluded — the repo cannot
 * exclude, filter here), padded from featured when the category is thin.
 */
export async function getRelated(product: ProductDTO, limit = 4): Promise<ProductCardDTO[]> {
  const page = await listPublished({ categorySlug: product.category.slug, limit });
  const fromCategory = page.items.filter((p) => p.id !== product.id).map(toProductCardDTO);
  if (fromCategory.length >= limit) return fromCategory.slice(0, limit);

  const featured = await getFeatured(limit * 2);
  const padded = featured
    .filter((f) => f.id !== product.id && !fromCategory.some((item) => item.id === f.id))
    .map(toProductCardDTO);
  return [...fromCategory, ...padded].slice(0, limit);
}