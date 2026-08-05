/**
 * Product queries — storefront catalog + dashboard inventory list.
 * Thin query layer: filtering/pagination only, no business validation.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { idCursor, normalizeLimit, toPage, type Page, type PageParams } from './pagination';

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'featured';

export type ListPublishedParams = PageParams & {
  categorySlug?: string;
  search?: string;
  sort?: ProductSort;
};

/** Shape shared by storefront product cards (catalog, featured, search). */
const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  imageUrls: true,
  priceCents: true,
  currency: true,
  stockQty: true,
  featured: true,
  isPublished: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ProductSelect;

export type ProductCard = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

export async function listPublished({
  categorySlug,
  search,
  sort = 'newest',
  cursor,
  limit,
}: ListPublishedParams = {}): Promise<Page<ProductCard>> {
  const take = normalizeLimit(limit);
  const where: Prisma.ProductWhereInput = {
    isPublished: true,
    deletedAt: null,
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === 'price-asc'
      ? [{ priceCents: 'asc' }, { id: 'asc' }]
      : sort === 'price-desc'
        ? [{ priceCents: 'desc' }, { id: 'desc' }]
        : sort === 'featured'
          ? [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
          : [{ createdAt: 'desc' }, { id: 'desc' }];

  const rows = await prisma.product.findMany({
    where,
    orderBy,
    take: take + 1,
    ...idCursor(cursor),
    select: productCardSelect,
  });

  return toPage(rows, take);
}

export async function getBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isPublished: true, deletedAt: null },
    include: { category: true },
  });
}

export async function getFeatured(limit = 8): Promise<ProductCard[]> {
  return prisma.product.findMany({
    where: { isPublished: true, deletedAt: null, featured: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: Math.min(Math.trunc(limit), 50),
    select: productCardSelect,
  });
}

export async function getById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export type LowStockItem = {
  id: string;
  name: string;
  slug: string;
  stockQty: number;
  lowStockThreshold: number;
  categoryName: string;
};

/**
 * Products at or below their low-stock threshold.
 * Prisma cannot compare two columns in a `where`, so this uses a raw SQL
 * column-to-column comparison (allowed by postgres-patterns for such cases).
 */
export async function lowStock(): Promise<LowStockItem[]> {
  return prisma.$queryRaw<LowStockItem[]>(Prisma.sql`
    SELECT p."id", p."name", p."slug", p."stockQty", p."lowStockThreshold", c."name" AS "categoryName"
    FROM "Product" p
    JOIN "Category" c ON c."id" = p."categoryId"
    WHERE p."stockQty" <= p."lowStockThreshold" AND p."deletedAt" IS NULL
    ORDER BY p."stockQty" ASC
  `);
}

export type ListAllAdminParams = PageParams & {
  search?: string;
  categorySlug?: string;
  /** Include soft-deleted products (dashboard "show archived" toggle). */
  includeDeleted?: boolean;
};

/** Dashboard inventory list — includes unpublished products. */
export async function listAllAdmin({
  search,
  categorySlug,
  includeDeleted = false,
  cursor,
  limit,
}: ListAllAdminParams = {}) {
  const take = normalizeLimit(limit, 25);
  const where: Prisma.ProductWhereInput = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...idCursor(cursor),
    select: {
      id: true,
      slug: true,
      name: true,
      priceCents: true,
      currency: true,
      stockQty: true,
      lowStockThreshold: true,
      isPublished: true,
      featured: true,
      deletedAt: true,
      imageUrls: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { slug: true, name: true } },
    },
  });

  return toPage(rows, take);
}
