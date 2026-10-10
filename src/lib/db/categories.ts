/**
 * Category queries + admin category CRUD.
 *
 * Two audiences, one file:
 * - Storefront (`listAll`): ACTIVE categories only — an inactive category
 *   disappears from header nav, homepage showcase and catalog filters.
 * - Admin (`listCategoriesForAdmin` / `getCategoryById` / mutations): no
 *   isActive filter, plus a `productCount` so the screen can show usage and
 *   guard deletes.
 *
 * Product visibility rule: deactivating a category hides the CATEGORY only.
 * Products keep their own `isPublished`/`deletedAt` gates (src/lib/db/products.ts
 * and catalogWhere never look at `category.isActive`) — hiding sellable stock
 * because its category is off would be a revenue bug.
 */
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { NotFoundError, ValidationError } from '../errors';
import type { CreateCategoryInput, UpdateCategoryInput } from '../validation/category';
import { catalogWhere, type CatalogSearchParams } from './catalog';

export type CategoryWithCount = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

/** Admin category row — the contract /admin/categories consumes. */
export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  /**
   * ALL product rows referencing the category — published or not, soft-deleted
   * or not. That is the number the FK `onDelete: Restrict` blocks on, so it is
   * both the "3 products" the screen shows and the count in the delete refusal.
   */
  productCount: number;
  createdAt: string; // ISO-8601 (api.ts convention — no raw Date across the boundary)
  updatedAt: string;
};

/**
 * Catalog filters that affect counts — the category itself is deliberately
 * excluded: counts answer "how many products in THIS category match the
 * current search/price/availability?", which is also what the "All tools"
 * chip sums up (additive filtering per build plan §C).
 */
export type CategoryCountFilter = Omit<CatalogSearchParams, 'categorySlug'>;

/**
 * Stable argument identity for the unfiltered storefront query. `React.cache`
 * keys its per-request memo by argument REFERENCE, so `listAll()` and an
 * all-undefined filter (the catalog's unfiltered `listFilters`) must resolve to
 * this same object; a fresh `{}` default per call would defeat the cache.
 */
const EMPTY_CATEGORY_FILTER: CategoryCountFilter = Object.freeze({}) as CategoryCountFilter;

/** Collapses "no filter" shapes (bare, `{}`, all-undefined) onto one cache key. */
function canonicalFilter(filter: CategoryCountFilter): CategoryCountFilter {
  return filter.search === undefined &&
    filter.minPriceCents === undefined &&
    filter.maxPriceCents === undefined &&
    filter.stock === undefined
    ? EMPTY_CATEGORY_FILTER
    : filter;
}

/**
 * The read itself, memoized per request via `React.cache`. The storefront
 * layout (header nav) and the page (homepage showcase / catalog sidebar) both
 * call `listAll` in the same render; with a stable argument they now share one
 * query instead of issuing the identical findMany + count aggregates twice.
 */
const queryActiveCategories = cache(
  async (filter: CategoryCountFilter): Promise<CategoryWithCount[]> => {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      // `description` is admin-only (listCategoriesForAdmin) — nothing on the
      // storefront reads it, so it must not be fetched/serialized here.
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            products: { where: { isPublished: true, deletedAt: null, ...catalogWhere(filter) } },
          },
        },
      },
    });

    return rows.map(({ _count, ...rest }) => ({ ...rest, productCount: _count.products }));
  },
);

/**
 * All ACTIVE categories with counts of published, non-deleted products matching
 * the active storefront filters (filtered relation count). This is the
 * storefront query (header nav, homepage showcase, catalog sidebar) — inactive
 * categories are excluded in the WHERE clause, not by callers. Admin screens
 * use `listCategoriesForAdmin()` instead.
 */
export async function listAll(filter: CategoryCountFilter = EMPTY_CATEGORY_FILTER): Promise<CategoryWithCount[]> {
  return queryActiveCategories(canonicalFilter(filter));
}

const adminCategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect;

type AdminCategoryRow = Prisma.CategoryGetPayload<{ select: typeof adminCategorySelect }>;

function toAdminCategory({ _count, createdAt, updatedAt, ...rest }: AdminCategoryRow): AdminCategory {
  return {
    ...rest,
    productCount: _count.products,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

/** ALL categories (active + inactive), name-ordered, each with its product count. */
export async function listCategoriesForAdmin(): Promise<AdminCategory[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: adminCategorySelect,
  });
  return rows.map(toAdminCategory);
}

/** One category by id (admin shape) — null when it does not exist. */
export async function getCategoryById(id: string): Promise<AdminCategory | null> {
  const row = await prisma.category.findUnique({ where: { id }, select: adminCategorySelect });
  return row ? toAdminCategory(row) : null;
}

/**
 * Exact, human-readable slug-collision copy — the category twin of
 * products-admin's slugConflictMessage (same curly quotes, shown both as the
 * page-level VALIDATION message and under the Slug field).
 */
export function categorySlugConflictMessage(existingName: string, slug: string): string {
  return `A category named \u201c${existingName}\u201d already uses the slug \u201c${slug}\u201d. Pick a different slug.`;
}

function throwSlugConflict(existingName: string, slug: string): never {
  const message = categorySlugConflictMessage(existingName, slug);
  throw new ValidationError(message, { fieldErrors: { slug: [message] } });
}

export async function createCategory(input: CreateCategoryInput): Promise<AdminCategory> {
  // Friendly pre-check, then create — same pattern as products-admin. Category
  // slugs have no soft-delete, so ANY row owning the slug blocks. Race
  // fallback: P2002 → generic CONFLICT via toActionResult (two admins, same slug).
  const slugOwner = await prisma.category.findUnique({ where: { slug: input.slug }, select: { name: true } });
  if (slugOwner) throwSlugConflict(slugOwner.name, input.slug);

  const row = await prisma.category.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description || null, // '' and undefined both store NULL
      isActive: input.isActive,
    },
    select: adminCategorySelect,
  });
  return toAdminCategory(row);
}

export async function updateCategory(id: string, input: UpdateCategoryInput): Promise<AdminCategory> {
  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!existing) throw new NotFoundError('Category not found');

  // Collision guard — the category being edited never conflicts with itself.
  if (input.slug !== undefined && input.slug !== existing.slug) {
    const slugOwner = await prisma.category.findUnique({
      where: { slug: input.slug },
      select: { name: true },
    });
    if (slugOwner) throwSlugConflict(slugOwner.name, input.slug);
  }

  // Partial patch: only the keys the caller sent — an absent key (including an
  // explicitly-undefined one) leaves that column untouched, so renaming never
  // re-derives the slug and never writes to any other row.
  const patch: Prisma.CategoryUpdateInput = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.slug !== undefined) patch.slug = input.slug;
  if (input.description !== undefined) patch.description = input.description || null;
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const row = await prisma.category.update({ where: { id }, data: patch, select: adminCategorySelect });
  return toAdminCategory(row);
}

/**
 * Hard delete, BLOCKED while any product references the category — the friendly
 * refusal mirrors the schema's FK `onDelete: Restrict` ("recategorize first")
 * but lands as a VALIDATION error with the count instead of a raw P2003.
 * Count + delete run in one transaction so the check cannot drift from the delete.
 */
export async function deleteCategory(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { id },
      select: { id: true, _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundError('Category not found');

    const count = category._count.products;
    if (count > 0) {
      const message = `Category has ${count} product${count === 1 ? '' : 's'}. Reassign ${
        count === 1 ? 'it' : 'them'
      } first.`;
      throw new ValidationError(message, { productCount: count });
    }

    await tx.category.delete({ where: { id } });
  });
}

/** Flips `isActive` (storefront visibility) — read-modify-write on one row. */
export async function toggleCategoryActive(id: string): Promise<AdminCategory> {
  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!existing) throw new NotFoundError('Category not found');

  const row = await prisma.category.update({
    where: { id },
    data: { isActive: !existing.isActive },
    select: adminCategorySelect,
  });
  return toAdminCategory(row);
}
