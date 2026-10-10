/**
 * Admin product operations (dashboard inventory). Composed over the db
 * product queries + direct prisma writes.
 * DB-REPO GAP (reported): db/products.ts has no create/update/toggle/soft-delete
 * primitives, and listAllAdmin's select omits description + category.id, so
 * the DTO-faithful admin list re-queries here. database-agent may formalize.
 */
import 'server-only';
import { InventoryMovementType, InventoryReason, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { idCursor, normalizeLimit, toPage } from '@/lib/db/pagination';
import { NotFoundError, ValidationError } from '@/lib/errors';
import type { Page } from '@/types/api';
import type { Product, Category } from '@prisma/client';

export type AdminProduct = Product & { category: Category };

export type ListProductsParams = {
  search?: string;
  categorySlug?: string;
  includeDeleted?: boolean;
  cursor?: string;
  limit?: number;
};

export async function listProductsAdmin(params: ListProductsParams = {}): Promise<Page<AdminProduct>> {
  const take = normalizeLimit(params.limit, 25);
  const where: Prisma.ProductWhereInput = {
    ...(params.includeDeleted ? {} : { deletedAt: null }),
    ...(params.categorySlug ? { category: { slug: params.categorySlug } } : {}),
    ...(params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: 'insensitive' } },
            { slug: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...idCursor(params.cursor),
    include: { category: true },
  });
  return toPage(rows, take);
}

export async function getProductAdmin(productId: string): Promise<AdminProduct> {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product) throw new NotFoundError('Product not found');
  return product;
}

/**
 * Exact, human-readable slug-collision copy. Shown twice (same text): as the
 * ValidationError.message (page-level if the form renders non-VALIDATION
 * errors) and under the Slug field via details.fieldErrors.
 */
export function slugConflictMessage(existingName: string, slug: string): string {
  return `A product named \u201c${existingName}\u201d already uses the slug \u201c${slug}\u201d. Delete it or pick a different slug.`;
}

function throwSlugConflict(existingName: string, slug: string): never {
  const message = slugConflictMessage(existingName, slug);
  throw new ValidationError(message, { fieldErrors: { slug: [message] } });
}

export async function createProduct(data: {
  name: string;
  slug: string;
  description?: string;
  priceCents: number;
  categoryId: string;
  stockQty: number;
  lowStockThreshold: number;
  isPublished: boolean;
  featured: boolean;
  imageUrls: string[];
}): Promise<AdminProduct> {
  return prisma.$transaction(async (tx) => {
    // Friendly pre-check (partial unique index only constrains LIVE rows —
    // soft-deleted slugs are reusable). Race fallback: P2002 → generic
    // CONFLICT in src/lib/errors.ts (two admins creating the same slug).
    const slugOwner = await tx.product.findFirst({
      where: { slug: data.slug, deletedAt: null },
      select: { name: true },
    });
    if (slugOwner) throwSlugConflict(slugOwner.name, data.slug);

    const product = await tx.product.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        priceCents: data.priceCents,
        categoryId: data.categoryId,
        stockQty: data.stockQty,
        lowStockThreshold: data.lowStockThreshold,
        isPublished: data.isPublished,
        featured: data.featured,
        imageUrls: data.imageUrls,
      },
      include: { category: true },
    });
    // Ledger completeness: initial stock is a RESTOCK movement.
    if (product.stockQty > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: InventoryMovementType.IN,
          reason: InventoryReason.RESTOCK,
          quantity: product.stockQty,
          note: 'Initial stock on product creation',
        },
      });
    }
    return product;
  });
}

export async function updateProduct(
  productId: string,
  data: Partial<{
    name: string;
    slug: string;
    description?: string | null;
    priceCents: number;
    categoryId: string;
    stockQty: number;
    lowStockThreshold: number;
    isPublished: boolean;
    featured: boolean;
    imageUrls: string[];
  }>,
): Promise<AdminProduct> {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError('Product not found');

  // Slug collision guard — same friendly copy as createProduct, but the
  // product being edited never conflicts with its own slug. Soft-deleted
  // rows don't block (partial unique index). Race fallback: P2002 mapping.
  if (data.slug !== undefined && data.slug !== existing.slug) {
    const slugOwner = await prisma.product.findFirst({
      where: { slug: data.slug, deletedAt: null, id: { not: productId } },
      select: { name: true },
    });
    if (slugOwner) throwSlugConflict(slugOwner.name, data.slug);
  }

  const stockDelta = data.stockQty !== undefined ? data.stockQty - existing.stockQty : 0;
  const patch = { ...data, description: data.description === undefined ? undefined : data.description ?? null };

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id: productId }, data: patch, include: { category: true } });
    // Keep the ledger in sync when the admin edits stock directly.
    if (stockDelta !== 0) {
      await tx.inventoryMovement.create({
        data: {
          productId,
          type: stockDelta > 0 ? InventoryMovementType.IN : InventoryMovementType.OUT,
          reason: InventoryReason.ADJUSTMENT,
          quantity: Math.abs(stockDelta),
          note: 'Stock changed via product edit',
        },
      });
    }
    return updated;
  });
  return product;
}

export async function togglePublish(productId: string): Promise<AdminProduct> {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError('Product not found');
  return prisma.product.update({
    where: { id: productId },
    data: { isPublished: !existing.isPublished },
    include: { category: true },
  });
}

/** Soft delete — order history stays intact (deletedAt filters everywhere). */
export async function softDeleteProduct(productId: string): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError('Product not found');
  await prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date(), isPublished: false } });
}

/**
 * Stock adjustment (dashboard): IN/RESTOCK|ADJUSTMENT or OUT/ADJUSTMENT with
 * ledger entry, in one transaction. Never allows negative stock.
 * DB-REPO GAP (reported): no stock-update primitive exists in db repos —
 * composed here from prisma directly.
 */
export async function adjustStock(input: {
  productId: string;
  quantity: number;
  reason: 'RESTOCK' | 'ADJUSTMENT';
  direction: 'IN' | 'OUT';
  note?: string;
}): Promise<AdminProduct> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId }, include: { category: true } });
    if (!product) throw new NotFoundError('Product not found');

    const delta = input.direction === 'IN' ? input.quantity : -input.quantity;
    if (product.stockQty + delta < 0) {
      throw new ValidationError(`Cannot reduce stock below zero (current stock: ${product.stockQty})`);
    }

    const updated = await tx.product.update({
      where: { id: input.productId },
      data: { stockQty: { increment: delta } },
      include: { category: true },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: input.productId,
        type: input.direction,
        reason: input.reason,
        quantity: input.quantity,
        note: input.note ?? null,
      },
    });
    return updated;
  });
}
