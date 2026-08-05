/**
 * Category queries — storefront navigation + filters.
 */
import { prisma } from '../db';

export type CategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
};

/** All categories with counts of published, non-deleted products (filtered relation count). */
export async function listAll(): Promise<CategoryWithCount[]> {
  const rows = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: {
        select: {
          products: { where: { isPublished: true, deletedAt: null } },
        },
      },
    },
  });

  return rows.map(({ _count, ...rest }) => ({ ...rest, productCount: _count.products }));
}
