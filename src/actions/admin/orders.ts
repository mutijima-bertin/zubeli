'use server';
/**
 * Admin order actions (ADR 0003). Every action calls requireAdminOrThrow
 * first; the transitions themselves live in lib/orders-admin (the only
 * writer of OrderStatus). Nothing client-side can change order status.
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { adminListOrdersSchema, orderIdSchema } from '@/lib/validation/orders';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import { cancelOrder, confirmOrderPayment, fulfillOrder, getOrderAdmin, listOrdersAdmin, refundOrder } from '@/lib/orders-admin';
import { buildPaymentInstructions } from '@/lib/payments';
import { notifyOrderCustomer } from '@/lib/notifications';
import { toActionResult } from '@/lib/errors';
import { toOrderDTO, toOrderListItemDTO } from '@/lib/dto';
import type { ActionResult, OrderDTO, OrderListItemDTO, Page } from '@/types/api';

function invalidateOrderCaches(orderId: string): void {
  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/account/orders');
  revalidatePath(`/account/orders/${orderId}`);
  revalidateTag(`orders:${orderId}`);
  revalidateTag('products'); // cancellations/refunds restock
}

export async function listOrdersAdminAction(input: unknown): Promise<ActionResult<Page<OrderListItemDTO>>> {
  try {
    await requireAdminOrThrow();
    const params = adminListOrdersSchema.parse(input);
    const page = await listOrdersAdmin(params);
    return { ok: true, data: { items: page.items.map(toOrderListItemDTO), nextCursor: page.nextCursor, hasMore: page.hasMore } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getOrderAdminAction(input: unknown): Promise<ActionResult<OrderDTO>> {
  try {
    await requireAdminOrThrow();
    const { orderId } = orderIdSchema.parse(input);
    const order = await getOrderAdmin(orderId);
    const dto = toOrderDTO(order);
    dto.paymentInstructions = order.payment ? buildPaymentInstructions(order, order.payment.method) : null;
    return { ok: true, data: dto };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function confirmOrderPaymentAction(input: unknown): Promise<ActionResult<OrderDTO>> {
  try {
    const admin = await requireAdminOrThrow();
    const { orderId } = orderIdSchema.parse(input);
    const order = await confirmOrderPayment(orderId, admin); // PENDING → PAID
    invalidateOrderCaches(orderId);
    await notifyOrderCustomer(order, {
      type: 'ORDER_STATUS',
      title: `Order ${order.number} paid`,
      body: 'Payment confirmed',
      link: `/account/orders/${order.id}`,
    });
    return { ok: true, data: toOrderDTO(order) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function fulfillOrderAction(input: unknown): Promise<ActionResult<OrderDTO>> {
  try {
    await requireAdminOrThrow();
    const { orderId } = orderIdSchema.parse(input);
    const order = await fulfillOrder(orderId); // PAID → FULFILLED
    invalidateOrderCaches(orderId);
    await notifyOrderCustomer(order, {
      type: 'ORDER_STATUS',
      title: `Order ${order.number} on the way`,
      body: 'Your order is on the way',
      link: `/account/orders/${order.id}`,
    });
    return { ok: true, data: toOrderDTO(order) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function cancelOrderAction(input: unknown): Promise<ActionResult<OrderDTO>> {
  try {
    await requireAdminOrThrow();
    const { orderId } = orderIdSchema.parse(input);
    const order = await cancelOrder(orderId); // PENDING|PAID → CANCELLED + restock
    invalidateOrderCaches(orderId);
    await notifyOrderCustomer(order, {
      type: 'ORDER_STATUS',
      title: `Order ${order.number} cancelled`,
      body: 'Your order has been cancelled',
      link: `/account/orders/${order.id}`,
    });
    return { ok: true, data: toOrderDTO(order) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function refundOrderAction(input: unknown): Promise<ActionResult<OrderDTO>> {
  try {
    await requireAdminOrThrow();
    const { orderId } = orderIdSchema.parse(input);
    const order = await refundOrder(orderId); // PAID|FULFILLED → REFUNDED + restock
    invalidateOrderCaches(orderId);
    await notifyOrderCustomer(order, {
      type: 'ORDER_STATUS',
      title: `Order ${order.number} refunded`,
      body: 'Your order has been refunded',
      link: `/account/orders/${order.id}`,
    });
    return { ok: true, data: toOrderDTO(order) };
  } catch (error) {
    return toActionResult(error);
  }
}
