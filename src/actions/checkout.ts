'use server';
/**
 * Checkout actions (ADR 0003). Guest checkout is allowed — the cart identity
 * comes from the cart_token cookie, the session user is attached when present.
 * createOrderAction is idempotent: idempotencyKey = cart id → double-submit
 * returns the existing order (createOrder in the db repo).
 */
import { revalidatePath, revalidateTag } from 'next/cache';
import { checkoutSchema } from '@/lib/validation/checkout';
import { orderIdSchema } from '@/lib/validation/orders';
import { getSession } from '@/lib/auth/session';
import { ensureCart, getCart } from '@/lib/cart';
import { buildCheckoutContext, placeOrder } from '@/lib/orders';
import { getOrderById } from '@/lib/db/orders';
import { buildPaymentInstructions, isPaymentMethodOffered, paymentMethodLabel } from '@/lib/payments';
import { notifyOrderOwners, notifyOwners } from '@/lib/notifications';
import { clientIp } from '@/lib/request';
import { assertRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { NotFoundError, toActionResult } from '@/lib/errors';
import { toOrderDTO } from '@/lib/dto';
import { formatRWF } from '@/lib/format';
import type { ActionResult, CartDTO, CheckoutResult, PaymentInstructions } from '@/types/api';

/**
 * Server-only checkout schema: `checkoutSchema` (client-safe) plus the
 * configured `PAYMENT_METHODS` allowlist. Kept out of
 * src/lib/validation/checkout.ts because `isPaymentMethodOffered` reads the
 * server-only site config. A disallowed method is rejected as a ZodError, so the
 * client receives a field-level `details.fieldErrors.paymentMethod` instead of a
 * generic provider message — before any DB work happens.
 */
const serverCheckoutSchema = checkoutSchema.superRefine((data, ctx) => {
  if (!isPaymentMethodOffered(data.paymentMethod)) {
    ctx.addIssue({
      code: 'custom',
      path: ['paymentMethod'],
      message: 'This payment method is not currently available',
    });
  }
});

export async function getCheckoutCartAction(): Promise<ActionResult<CartDTO>> {
  try {
    const cart = await getCart();
    return { ok: true, data: cart };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createOrderAction(input: unknown): Promise<ActionResult<CheckoutResult>> {
  try {
    const data = serverCheckoutSchema.parse(input);

    const user = await getSession(); // optional — guest checkout allowed
    const cart = await ensureCart();
    await assertRateLimit(`checkout:${await clientIp()}:${cart.id}`, RATE_LIMITS.checkout);

    // Validates the cart is non-empty and items are still purchasable.
    const context = await buildCheckoutContext(cart.id);

    const { order, paymentInstructions } = await placeOrder({
      userId: user?.id,
      customer: data.customer,
      items: context.items,
      paymentMethod: data.paymentMethod,
      bankTransferReference: data.bankTransferReference,
      idempotencyKey: cart.id, // one order per cart
    });

    revalidateTag(`cart:${cart.id}`);
    revalidatePath('/account/orders');
    revalidatePath('/admin/orders');

    // Owner notifications (fail-soft — a notification failure never breaks
    // order placement). bankTransferReference is guaranteed present for
    // BANK_TRANSFER orders by checkoutSchema + placeOrder.
    const payment = order.payment;
    if (payment) {
      const ownerLink = `/admin/orders/${order.id}`;
      await notifyOrderOwners(order, {
        type: 'NEW_ORDER',
        title: `New order ${order.number}`,
        body: `${paymentMethodLabel(payment.method)} for ${formatRWF(order.totalCents, order.currency)}`,
        link: ownerLink,
      });
      if (payment.method === 'BANK_TRANSFER' && order.bankTransferReference) {
        await notifyOwners({
          type: 'PAYMENT_REVIEW',
          title: 'Bank-transfer payment to verify',
          body: `Reference ${order.bankTransferReference} on order ${order.number}`,
          link: ownerLink,
        });
      }
    }

    return { ok: true, data: { order: toOrderDTO(order), paymentInstructions } };
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Public order lookup for the guest checkout success page (Decision A,
 * storefront-build-plan). No auth — the order id (cuid) is high-entropy and
 * only known to the customer who just placed the order. Mirrors
 * createOrderAction's CheckoutResult shape exactly so the success screen
 * renders identical data. No rate limit: the sibling read action
 * (getCheckoutCartAction) has none either, and a per-IP limiter would
 * 429 legitimate success-page refreshes.
 */
export async function getCheckoutOrderAction(input: unknown): Promise<ActionResult<CheckoutResult>> {
  try {
    const { orderId } = orderIdSchema.parse(input);
    const order = await getOrderById(orderId);
    if (!order) throw new NotFoundError('Order not found');

    // Payment is always created 1:1 with the order (createOrder); the fallback
    // keeps this total for any corrupt row, same as placeOrder.
    const paymentInstructions: PaymentInstructions = order.payment
      ? buildPaymentInstructions(order, order.payment.method)
      : { title: 'Payment on delivery', steps: [] };

    return { ok: true, data: { order: toOrderDTO(order), paymentInstructions } };
  } catch (error) {
    return toActionResult(error);
  }
}
