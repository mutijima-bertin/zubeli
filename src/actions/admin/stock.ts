'use server';
/**
 * Admin stock actions (dashboard). Stock changes are ledger-backed:
 * every adjustment writes an InventoryMovement row in the same transaction.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { listMovementsSchema, stockAdjustSchema } from '@/lib/validation/stock';
import { adminListProductsSchema } from '@/lib/validation/product';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import { adjustStock, listProductsAdmin } from '@/lib/products-admin';
import { listMovements } from '@/lib/db/inventory';
import { toActionResult } from '@/lib/errors';
import { toProductDTO, toStockMovementDTO } from '@/lib/dto';
import type { ActionResult, Page, ProductDTO, StockMovementDTO } from '@/types/api';

function invalidateStockCaches(): void {
  revalidateTag('products');
  revalidatePath('/admin/stock');
  revalidatePath('/admin/products');
  revalidatePath('/products');
}

export async function listStockAdminAction(input: unknown): Promise<ActionResult<Page<ProductDTO>>> {
  try {
    await requireAdminOrThrow();
    const params = adminListProductsSchema.parse(input);
    const page = await listProductsAdmin(params);
    return { ok: true, data: { items: page.items.map(toProductDTO), nextCursor: page.nextCursor, hasMore: page.hasMore } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function adjustStockAction(input: unknown): Promise<ActionResult<ProductDTO>> {
  try {
    await requireAdminOrThrow();
    const data = stockAdjustSchema.parse(input);
    const product = await adjustStock(data);
    invalidateStockCaches();
    return { ok: true, data: toProductDTO(product) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function listMovementsAction(input: unknown): Promise<ActionResult<Page<StockMovementDTO>>> {
  try {
    await requireAdminOrThrow();
    const params = listMovementsSchema.parse(input);
    const page = await listMovements(params);
    return { ok: true, data: { items: page.items.map(toStockMovementDTO), nextCursor: page.nextCursor, hasMore: page.hasMore } };
  } catch (error) {
    return toActionResult(error);
  }
}
