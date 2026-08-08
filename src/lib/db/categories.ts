/**
 * Category queries — storefront navigation + filters.
 */
import { prisma } from '../db';
import { catalogWhere, type CatalogSearchParams } from './catalog';

export type CategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
};

/**
 * Catalog filters that affect counts — the category itself is deliberately
 * excluded: counts answer "how many products in THIS category match the
 * current search/price/availability?", which is also what the "All tools"
 * chip sums up (additive filtering per build plan §C).
 */
export type CategoryCountFilter = Omit<CatalogSearchParams, 'categorySlug'>;

/**
 * All categories with counts of published, non-deleted products matching the
 * active storefront filters (filtered relation count). Called with no filter
 * by the homepage/admin (unfiltered counts).
 */
export async function listAll(filter: CategoryCountFilter = {}): Promise<CategoryWithCount[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: {
        select: {
          products: { where: { isPublished: true, deletedAt: null, ...catalogWhere(filter) } },
        },
      },
    },
  });

  return rows.map(({ _count, ...rest }) => ({ ...rest, productCount: _count.products }));
}
