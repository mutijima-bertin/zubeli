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
import type { Page, ProductCardDTO, ProductDTO } from "@/types/api";

export const CATALOG_PAGE_SIZE = 20;

const VALID_SORTS = new Set<ProductSort>(["newest", "price-asc", "price-desc", "featured"]);

function normalizeSort(raw: string | null | undefined): ProductSort {
  return raw && VALID_SORTS.has(raw as ProductSort) ? (raw as ProductSort) : "newest";
}

export type CatalogFilter = { q: string | null; cat: string | null; sort: ProductSort };

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
  /** Echo of the applied filters — drives filter UI + "showing X of" copy. */
  filter: { q: string | null; cat: string | null; sort: ProductSort };
};

/**
 * Catalog page (list + filter echo). Cursor pagination per ADR 0004 —
 * filter/sort changes must reset the cursor (contract in the build plan).
 */
export async function getCatalogPage(params: {
  q?: string;
  cat?: string;
  sort?: string;
  cursor?: string;
}): Promise<CatalogPageData> {
  const { q, cat, cursor } = params;
  const sort = normalizeSort(params.sort);
  const [result, categories] = await Promise.all([
    listPublished({
      categorySlug: cat || undefined,
      search: q || undefined,
      sort,
      cursor,
      limit: CATALOG_PAGE_SIZE,
    }),
    listAll(),
  ]);
  return {
    page: {
      items: result.items.map(toProductCardDTO),
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    },
    categories,
    filter: { q: q ?? null, cat: cat ?? null, sort },
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