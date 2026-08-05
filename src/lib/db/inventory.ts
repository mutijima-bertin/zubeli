/**
 * Inventory ledger queries — append-only stock movements (ADR 0001).
 * quantity is always positive; direction comes from `type`.
 */
import { InventoryMovementType, InventoryReason } from '@prisma/client';
import { prisma } from '../db';
import { idCursor, normalizeLimit, toPage, type PageParams } from './pagination';
import { InvalidQuantityError } from './errors';

export type CreateMovementInput = {
  productId: string;
  type: InventoryMovementType;
  reason: InventoryReason;
  quantity: number;
  note?: string;
  orderId?: string;
};

export async function createMovement(input: CreateMovementInput) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new InvalidQuantityError(`InventoryMovement quantity must be a positive integer, got ${input.quantity}`);
  }
  return prisma.inventoryMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      reason: input.reason,
      quantity: input.quantity,
      note: input.note ?? null,
      orderId: input.orderId ?? null,
    },
  });
}

export type ListMovementsParams = PageParams & { productId?: string };

/** Stock ledger, newest first, cursor-paginated; filter by product. */
export async function listMovements({ productId, cursor, limit }: ListMovementsParams = {}) {
  const take = normalizeLimit(limit, 25);
  const rows = await prisma.inventoryMovement.findMany({
    where: productId ? { productId } : {},
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...idCursor(cursor),
    select: {
      id: true,
      type: true,
      reason: true,
      quantity: true,
      note: true,
      createdAt: true,
      product: { select: { name: true, slug: true } },
      order: { select: { number: true } },
    },
  });

  return toPage(rows, take);
}
