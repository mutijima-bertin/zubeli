'use server';
/**
 * Admin customer actions. Registered customers + guest order snapshots
 * (id: null). Aggregates are computed in lib/customers-admin.
 */
import { adminListCustomersSchema, customerIdSchema } from '@/lib/validation/orders';
import { requireAdminOrThrow } from '@/lib/auth/guards';
import { getCustomer, listCustomers } from '@/lib/customers-admin';
import { toActionResult } from '@/lib/errors';
import { toOrderListItemDTO } from '@/lib/dto';
import type { ActionResult, CustomerDTO, OrderListItemDTO, Page } from '@/types/api';

export async function listCustomersAdminAction(input: unknown): Promise<ActionResult<Page<CustomerDTO>>> {
  try {
    await requireAdminOrThrow();
    const params = adminListCustomersSchema.parse(input);
    const page = await listCustomers(params);
    return { ok: true, data: page };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function getCustomerAdminAction(
  input: unknown,
): Promise<ActionResult<{ customer: CustomerDTO; orders: OrderListItemDTO[] }>> {
  try {
    await requireAdminOrThrow();
    const { customerId } = customerIdSchema.parse(input);
    const { customer, orders } = await getCustomer(customerId);
    return { ok: true, data: { customer, orders: orders.map(toOrderListItemDTO) } };
  } catch (error) {
    return toActionResult(error);
  }
}
