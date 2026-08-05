/**
 * Admin order operations — the only writers of OrderStatus (ADR 0003).
 * All functions assume the caller already ran requireAdminOrThrow
 * (actions do this first; these lib functions stay pure business logic).
 *
 * Transition rules implemented (task spec over ADR 0003 where noted):
 *   PENDING  → PAID       (confirmOrderPayment — only path to PAID in MVP)
 *   PENDING  → CANCELLED  (cancelOrder — restocks)
 *   PAID     → CANCELLED  (cancelOrder — restocks; allowed per task lifecycle,
 *                          paid-but-unfulfilled orders can be cancelled and the
 *                          payment marked FAILED — under pay-on-delivery the
 *                          money never changed hands)
 *   PAID     → FULFILLED  (fulfillOrder)
 *   PAID     → REFUNDED   (refundOrder — restocks IN/RETURN)
 *   FULFILLED→ REFUNDED   (refundOrder — restocks IN/RETURN)
 *   CANCELLED / REFUNDED are terminal.
 *
 * NOTE: ADR 0003 said "cancelOrder (PENDING → CANCELLED)" and "refundOrder
 * (PAID → REFUNDED, no auto-restock)". This implementation widens the
 * transitions to PENDING|PAID → CANCELLED and PAID|FULFILLED → REFUNDED with
 * auto-restock per the orchestrator's task spec — reported for the architect.
 */
import 'server-only';
import { InventoryMovementType, InventoryReason, OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getOrderById, listAllAdmin, orderDetailInclude } from '@/lib/db/orders';
import { InvalidTransitionError, NotFoundError, ValidationError } from '@/lib/errors';
import type { OrderDetail, OrderWithRelations } from '@/lib/db/orders';
import type { User } from '@prisma/client';
import type { PageParams } from '@/lib/db/pagination';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
  [OrderStatus.FULFILLED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ALLOWED_TRANSITIONS[from]?.includes(to)) {
    throw new InvalidTransitionError(`Cannot move order from ${from} to ${to}`, { from, to });
  }
}

async function refetchOrThrow(orderId: string): Promise<OrderDetail> {
  const order = await getOrderById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  return order;
}

/**
 * Restock + ledger entries for cancelled/refunded orders.
 * DB-REPO GAP (reported): db/inventory.createMovement does not accept a
 * transaction client and db/orders has no restock primitive — stock updates
 * and ledger writes are done directly here inside the same $transaction as
 * the status change. database-agent may formalize this later.
 */
async function restockItemsInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  order: OrderWithRelations,
  reason: InventoryReason,
): Promise<void> {
  for (const item of order.items) {
    if (!item.productId) continue; // product hard-deleted — nothing to restock
    await tx.product.update({
      where: { id: item.productId },
      data: { stockQty: { increment: item.quantity } },
    });
    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: InventoryMovementType.IN,
        reason,
        quantity: item.quantity,
        orderId: order.id,
        note: `Order ${order.number} (${reason.toLowerCase()})`,
      },
    });
  }
}

/**
 * PENDING → PAID. The ONLY path to PAID in the MVP (manual owner
 * confirmation; a verified webhook is the future second path — ADR 0003).
 * BANK_TRANSFER orders must carry the customer's bankTransferReference.
 */
export async function confirmOrderPayment(orderId: string, admin: User): Promise<OrderDetail> {
  const order = await refetchOrThrow(orderId);
  assertTransition(order.status, OrderStatus.PAID);

  const payment = order.payment;
  if (!payment) throw new NotFoundError('Payment not found for this order');
  if (payment.method === 'BANK_TRANSFER' && !order.bankTransferReference) {
    throw new ValidationError(
      'Bank transfer orders require the customer\'s bankTransferReference before the payment can be confirmed',
    );
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { orderId: order.id },
      data: { status: PaymentStatus.PAID, confirmedById: admin.id, confirmedAt: new Date() },
    }),
    prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID, paidAt: new Date() } }),
  ]);

  return refetchOrThrow(order.id);
}

/** PAID → FULFILLED. */
export async function fulfillOrder(orderId: string): Promise<OrderDetail> {
  const order = await refetchOrThrow(orderId);
  assertTransition(order.status, OrderStatus.FULFILLED);
  await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FULFILLED, fulfilledAt: new Date() } });
  return refetchOrThrow(order.id);
}

/** PENDING|PAID → CANCELLED. Restocks via IN/CANCEL movements. */
export async function cancelOrder(orderId: string): Promise<OrderDetail> {
  const order = await refetchOrThrow(orderId);
  assertTransition(order.status, OrderStatus.CANCELLED);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId: order.id },
      data: { status: PaymentStatus.FAILED, confirmedById: null, confirmedAt: null },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
    });
    await restockItemsInTx(tx, order, InventoryReason.CANCEL);
  });

  return refetchOrThrow(order.id);
}

/** PAID|FULFILLED → REFUNDED. Restocks via IN/RETURN movements. */
export async function refundOrder(orderId: string): Promise<OrderDetail> {
  const order = await refetchOrThrow(orderId);
  assertTransition(order.status, OrderStatus.REFUNDED);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { orderId: order.id }, data: { status: PaymentStatus.REFUNDED } });
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
    await restockItemsInTx(tx, order, InventoryReason.RETURN);
  });

  return refetchOrThrow(order.id);
}

// ---------------------------------------------------------------------------
// Thin read wrappers (DTO mapping happens in the actions)
// ---------------------------------------------------------------------------

export function listOrdersAdmin(params: PageParams & {
  status?: OrderStatus;
  paymentMethod?: 'COD_CASH' | 'COD_MOBILE_MONEY' | 'BANK_TRANSFER' | 'MOMO_GATEWAY' | 'CARD';
  search?: string;
}) {
  return listAllAdmin({
    status: params.status,
    paymentMethod: params.paymentMethod,
    search: params.search,
    cursor: params.cursor,
    limit: params.limit,
  });
}

export async function getOrderAdmin(orderId: string): Promise<OrderDetail> {
  return refetchOrThrow(orderId);
}

/** Full include used when the order detail needs relations beyond OrderDetail. */
export const adminOrderInclude = orderDetailInclude;
