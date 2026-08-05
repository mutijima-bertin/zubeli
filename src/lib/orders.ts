/**
 * Checkout orchestration — composes the order repo's createOrder transaction
 * with the payment provider abstraction (ADR 0003). All stock validation,
 * snapshots, Payment creation and cart clearing live inside createOrder —
 * never duplicated here.
 */
import 'server-only';
import { createOrder, getOrderById, listByUser } from '@/lib/db/orders';
import { getCartWithItems } from '@/lib/db/cart';
import { NotFoundError, NotAuthorizedError, ValidationError } from '@/lib/errors';
import { siteConfig } from '@/lib/site';
import { getPaymentProvider } from '@/lib/payments';
import type { PaymentInstructions } from '@/types/api';
import type { OrderDetail, OrderWithRelations } from '@/lib/db/orders';
import type { PaymentMethod } from '@prisma/client';

export type CheckoutContext = {
  cartId: string;
  items: { productId: string; quantity: number }[];
  subtotalCents: number;
  /** Snapshot of DELIVERY_FEE_CENTS at checkout — history never rewrites. */
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
};

export async function buildCheckoutContext(cartId: string): Promise<CheckoutContext> {
  const cart = await getCartWithItems(cartId);
  if (!cart) throw new NotFoundError('Cart not found');
  if (cart.items.length === 0) throw new ValidationError('Your cart is empty');
  const unavailable = cart.items.find((i) => !i.product.isPublished);
  if (unavailable) {
    throw new ValidationError(`"${unavailable.product.name}" is no longer available — remove it from your cart`);
  }
  const items = cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  const subtotalCents = cart.items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0);
  const deliveryFeeCents = siteConfig.deliveryFeeCents;
  return {
    cartId: cart.id,
    items,
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    currency: cart.items[0]?.product.currency ?? siteConfig.currency,
  };
}

export type PlaceOrderInput = {
  userId?: string;
  customer: { name: string; phone: string; email?: string; address: string; city?: string };
  items: { productId: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  bankTransferReference?: string;
  /** Cart id — one order per cart (createOrder is idempotent on this key). */
  idempotencyKey: string;
};

/**
 * Places the order (one $transaction inside createOrder) and resolves the
 * payment provider for the customer-facing instructions.
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<{ order: OrderWithRelations; paymentInstructions: PaymentInstructions }> {
  // Defense in depth: checkoutSchema already enforces this at the action
  // boundary, but placeOrder must never persist a bank-transfer order that
  // cannot be confirmed (provider requires the reference too).
  if (input.paymentMethod === 'BANK_TRANSFER' && !input.bankTransferReference) {
    throw new ValidationError('bankTransferReference is required when paying by bank transfer');
  }

  const order = await createOrder({
    userId: input.userId,
    customer: input.customer,
    items: input.items,
    paymentMethod: input.paymentMethod,
    bankTransferReference: input.bankTransferReference,
    idempotencyKey: input.idempotencyKey,
    cartId: input.idempotencyKey, // clear the cart we checked out
  });

  // createOrder always creates the 1:1 Payment in the same transaction.
  const payment = order.payment;
  if (!payment) throw new NotFoundError('Payment not found for this order');

  const provider = getPaymentProvider(payment.method);
  const intent = await provider.createPayment({
    orderId: order.id,
    method: payment.method,
    amountCents: payment.amountCents,
    currency: order.currency,
    idempotencyKey: order.idempotencyKey ?? order.id,
    customerName: order.customerName,
    bankTransferReference: order.bankTransferReference ?? undefined,
  });

  // MVP providers emit exactly one instruction block per method (ADR 0003);
  // the first block is the customer-facing payment card.
  const blocks = intent.instructions.map((i) => ({ title: i.title, steps: i.lines }));
  return {
    order,
    paymentInstructions: blocks[0] ?? { title: 'Payment on delivery', steps: [] },
  };
}

/** Account order detail with IDOR check (order.customerId must match the session user). */
export async function getOrderForUser(orderId: string, userId: string): Promise<OrderDetail> {
  const order = await getOrderById(orderId);
  if (!order) throw new NotFoundError('Order not found');
  if (order.customerId !== userId) throw new NotAuthorizedError('This order does not belong to you', 403);
  return order;
}

/** Account order history — thin wrapper over the db repo. */
export function listOrdersForUser(userId: string, params: { cursor?: string; limit?: number }) {
  return listByUser({ userId, cursor: params.cursor, limit: params.limit });
}
