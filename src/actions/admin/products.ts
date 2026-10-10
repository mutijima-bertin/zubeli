'use server';
/**
 * Admin product actions (dashboard inventory). Every action calls
 * requireAdminOrThrow first (security-review: client-side hiding is not a
 * control). Storefront-visible changes revalidate products tags/paths.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { adminListProductsSchema, adminUpdateProductSchema, productIdSchema, productSchema } from '@/lib/validation/product';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import {
  createProduct,
  getProductAdmin,
  listProductsAdmin,
  softDeleteProduct,
  togglePublish,
  updateProduct,
} from '@/lib/products-admin';
import { toActionResult } from '@/lib/errors';
import { notifyOwners } from '@/lib/notifications';
import { toProductDTO } from '@/lib/dto';
import type { ActionResult, Page, ProductDTO } from '@/types/api';

function invalidateProductCaches(): void {
  revalidateTag('products');
  revalidatePath('/products');
  revalidatePath('/admin/products');
  revalidatePath('/admin/stock');
}

export async function listProductsAdminAction(input: unknown): Promise<ActionResult<Page<ProductDTO>>> {
  try {
    await requireAdminOrThrow();
    const params = adminListProductsSchema.parse(input);
    const page = await listProductsAdmin(params);
    return { ok: true, data: { items: page.items.map(toProductDTO), nextCursor: page.nextCursor, hasMore: page.hasMore } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getProductAdminAction(input: unknown): Promise<ActionResult<ProductDTO>> {
  try {
    await requireAdminOrThrow();
    const { productId } = productIdSchema.parse(input);
    const product = await getProductAdmin(productId);
    return { ok: true, data: toProductDTO(product) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createProductAction(input: unknown): Promise<ActionResult<ProductDTO>> {
  try {
    await requireAdminOrThrow();
    const data = productSchema.parse(input);
    const product = await createProduct(data);
    invalidateProductCaches();
    // LOW_STOCK fires on creation when the initial stock is at/below threshold
    // (fail-soft — an admin-created product must never fail to appear).
    if (product.stockQty <= product.lowStockThreshold) {
      await notifyOwners({
        type: 'LOW_STOCK',
        title: `Low stock: ${product.name}`,
        body: `Only ${product.stockQty} left (threshold ${product.lowStockThreshold})`,
        link: '/admin/stock',
      });
    }
    return { ok: true, data: toProductDTO(product) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function updateProductAction(input: unknown): Promise<ActionResult<ProductDTO>> {
  try {
    await requireAdminOrThrow();
    const data = adminUpdateProductSchema.parse(input);
    const { productId, ...patch } = data;
    const product = await updateProduct(productId, patch);
    invalidateProductCaches();
    return { ok: true, data: toProductDTO(product) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function togglePublishAction(input: unknown): Promise<ActionResult<ProductDTO>> {
  try {
    await requireAdminOrThrow();
    const { productId } = productIdSchema.parse(input);
    const product = await togglePublish(productId);
    invalidateProductCaches();
    return { ok: true, data: toProductDTO(product) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function deleteProductAction(input: unknown): Promise<ActionResult<{ success: true }>> {
  try {
    await requireAdminOrThrow();
    const { productId } = productIdSchema.parse(input);
    await softDeleteProduct(productId); // soft delete — order history stays intact
    invalidateProductCaches();
    return { ok: true, data: { success: true } };
  } catch (error) {
    return toActionResult(error);
  }
}
