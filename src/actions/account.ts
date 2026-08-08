'use server';
/**
 * Customer account actions. Every owned fetch carries an IDOR check
 * (order.customerId === session user id, ADR 0002).
 */
import { profileSchema } from '@/lib/validation/auth';
import { orderIdSchema, pageParamsSchema } from '@/lib/validation/orders';
import { requireUser } from '@/lib/auth/session';
import { updateProfile } from '@/lib/db/users';
import { getOrderForUser, listOrdersForUser } from '@/lib/orders';
import { buildPaymentInstructions } from '@/lib/payments';
import { toActionResult } from '@/lib/errors';
import { toOrderDTO, toOrderListItemDTO, toUserDTO } from '@/lib/dto';
import type { ActionResult, OrderDTO, OrderListItemDTO, Page, UserDTO } from '@/types/api';

export async function updateProfileAction(input: unknown): Promise<ActionResult<UserDTO>> {
  try {
    const data = profileSchema.parse(input);
    const user = await requireUser();
    const updated = await updateProfile(user.id, { name: data.name, phone: data.phone });
    return { ok: true, data: toUserDTO(updated) };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getMyOrdersAction(input: unknown): Promise<ActionResult<Page<OrderListItemDTO>>> {
  try {
    const { cursor, limit } = pageParamsSchema.parse(input);
    const user = await requireUser();
    const page = await listOrdersForUser(user.id, { cursor, limit });
    return { ok: true, data: { items: page.items.map(toOrderListItemDTO), nextCursor: page.nextCursor, hasMore: page.hasMore } };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getMyOrderAction(input: unknown): Promise<ActionResult<OrderDTO>> {
  try {
    const { orderId } = orderIdSchema.parse(input);
    const user = await requireUser();
    const order = await getOrderForUser(orderId, user.id); // IDOR check inside
    const dto = toOrderDTO(order);
    dto.paymentInstructions = order.payment
      ? buildPaymentInstructions(order, order.payment.method)
      : null;
    return { ok: true, data: dto };
  } catch (error) {
    return toActionResult(error);
  }
}
