/**
 * Order / admin-list validation schemas (zod v4). Pure + client-safe.
 */
import { z } from 'zod';

export const orderStatusSchema = z.enum(['PENDING', 'PAID', 'FULFILLED', 'CANCELLED', 'REFUNDED']);
export type OrderStatusInput = z.infer<typeof orderStatusSchema>;

/** Admin order-list filter; includes reserved methods so history stays filterable. */
export const paymentMethodFilterSchema = z.enum(['COD_CASH', 'COD_MOBILE_MONEY', 'BANK_TRANSFER', 'MOMO_GATEWAY', 'CARD']);

export const pageParamsSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type PageParamsInput = z.infer<typeof pageParamsSchema>;

export const orderIdSchema = z.object({ orderId: z.string().min(1) });
export type OrderIdInput = z.infer<typeof orderIdSchema>;

export const adminListOrdersSchema = pageParamsSchema.extend({
  status: orderStatusSchema.optional(),
  paymentMethod: paymentMethodFilterSchema.optional(),
  search: z.string().trim().max(100).optional(),
});
export type AdminListOrdersInput = z.infer<typeof adminListOrdersSchema>;

export const adminListCustomersSchema = pageParamsSchema.extend({
  search: z.string().trim().max(100).optional(),
});
export type AdminListCustomersInput = z.infer<typeof adminListCustomersSchema>;

export const customerIdSchema = z.object({ customerId: z.string().min(1) });
export type CustomerIdInput = z.infer<typeof customerIdSchema>;

export const salesPeriodSchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((d) => d.from <= d.to, { message: 'from must be before or equal to to', path: ['from'] });
export type SalesPeriodInput = z.infer<typeof salesPeriodSchema>;

export const revenueMonthsSchema = z.object({
  months: z.coerce.number().int().min(1).max(36).optional(),
});
export type RevenueMonthsInput = z.infer<typeof revenueMonthsSchema>;

export const topProductsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
});
export type TopProductsInput = z.infer<typeof topProductsSchema>;
