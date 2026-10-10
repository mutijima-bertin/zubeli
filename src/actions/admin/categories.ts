'use server';
/**
 * Admin category actions (/admin/categories — owner: inventory screen agent).
 * Conventions are the sibling admin actions' (src/actions/admin/products.ts):
 * requireAdminOrThrow first, zod on every input, typed ActionResult envelope,
 * Postgres rate limiter, revalidatePath on storefront-visible change.
 *
 * Rate-limit bucket: siblings (products/orders/stock/customers) do NOT rate-limit
 * their mutations — only auth + checkout do. This file follows the mandated
 * pattern anyway: one shared `admin-category:${ip}` bucket keyed like the
 * existing `register:${ip}` / `checkout:${ip}:${cartId}` keys, generous enough
 * (120/min) that real catalog work never trips it.
 */
import { revalidatePath } from 'next/cache';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import { toActionResult } from '@/lib/errors';
import { clientIp } from '@/lib/request';
import { assertRateLimit } from '@/lib/rate-limit';
import * as categories from '@/lib/db/categories';
import { categoryIdSchema, createCategorySchema, updateCategorySchema } from '@/lib/validation/category';
import type { AdminCategory } from '@/lib/db/categories';
import type { ActionResult } from '@/types/api';

const ADMIN_CATEGORY_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const;

/** OWNER session + rate limit, before any validation/DB work. */
async function guardCategoryMutation(): Promise<void> {
  await requireAdminOrThrow();
  await assertRateLimit(`admin-category:${await clientIp()}`, ADMIN_CATEGORY_RATE_LIMIT);
}

/** Categories shape nav, filters, counts and the product-form selects. */
function invalidateCategoryCaches(): void {
  revalidatePath('/');
  revalidatePath('/products');
  revalidatePath('/admin/categories');
  revalidatePath('/admin/products');
}

export async function createCategory(input: unknown): Promise<ActionResult<AdminCategory>> {
  try {
    await guardCategoryMutation();
    const data = createCategorySchema.parse(input);
    const category = await categories.createCategory(data);
    invalidateCategoryCaches();
    return { ok: true, data: category };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateCategory(id: string, input: unknown): Promise<ActionResult<AdminCategory>> {
  try {
    await guardCategoryMutation();
    const categoryId = categoryIdSchema.parse(id);
    const data = updateCategorySchema.parse(input);
    const category = await categories.updateCategory(categoryId, data);
    invalidateCategoryCaches();
    return { ok: true, data: category };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult<{ success: true }>> {
  try {
    await guardCategoryMutation();
    const categoryId = categoryIdSchema.parse(id);
    await categories.deleteCategory(categoryId);
    invalidateCategoryCaches();
    return { ok: true, data: { success: true } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function toggleCategoryActive(id: string): Promise<ActionResult<AdminCategory>> {
  try {
    await guardCategoryMutation();
    const categoryId = categoryIdSchema.parse(id);
    const category = await categories.toggleCategoryActive(categoryId);
    invalidateCategoryCaches();
    return { ok: true, data: category };
  } catch (error) {
    return toActionResult(error);
  }
}
