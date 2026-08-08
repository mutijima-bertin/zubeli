import type { OrderStatus, PaymentMethod } from '@/types/api';

/**
 * Filter option lists shared by the server list page (URL parsing +
 * validation) and the client filter bar. Mirrors the allowed values of
 * `adminListOrdersSchema` (src/lib/validation/orders.ts) — including the
 * reserved gateway methods so historical orders stay filterable.
 */
export const ORDER_STATUS_OPTIONS: readonly { value: OrderStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FULFILLED', label: 'Fulfilled' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export const PAYMENT_METHOD_OPTIONS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'COD_CASH', label: 'Pay on delivery — cash' },
  { value: 'COD_MOBILE_MONEY', label: 'Pay on delivery — mobile money' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'MOMO_GATEWAY', label: 'Mobile money (gateway)' },
  { value: 'CARD', label: 'Card' },
];