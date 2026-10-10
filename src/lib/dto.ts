/**
 * DTO mapping functions (ADR 0004) — raw Prisma models never cross the
 * boundary. Dates → ISO strings, money stays integer minor units.
 * BigInt is not used anywhere (all Int).
 */
import 'server-only';
import type { Category, Order, OrderItem, Payment, Product, User } from '@prisma/client';
import { prisma } from '@/lib/db';
import type {
  CartDTO,
  CartItemDTO,
  CategoryDTO,
  CustomerDTO,
  DashboardKpiDTO,
  LowStockItemDTO,
  MonthlyRevenueDTO,
  OrderDTO,
  OrderItemDTO,
  OrderLineSummaryDTO,
  OrderListItemDTO,
  PaymentDTO,
  ProductCardDTO,
  ProductDTO,
  SalesOverviewDTO,
  StockMovementDTO,
  TopProductDTO,
  UserDTO,
} from '@/types/api';
import type { ProductCard } from '@/lib/db/products';
import type { LowStockItem } from '@/lib/db/products';
import type { MonthlyRevenue, OverviewKpis, PeriodReport, TopProduct } from '@/lib/db/sales';
import type { CartWithItems } from '@/lib/db/cart';

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

// ---------------------------------------------------------------------------
// Users / categories / products
// ---------------------------------------------------------------------------

export function toUserDTO(user: User): UserDTO {
  return { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
}

export function toCategoryDTO(category: Category): CategoryDTO {
  return { id: category.id, slug: category.slug, name: category.name };
}

export function toProductDTO(product: Product & { category: Category }): ProductDTO {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrls: product.imageUrls,
    priceCents: product.priceCents,
    currency: product.currency,
    stockQty: product.stockQty,
    lowStockThreshold: product.lowStockThreshold,
    isPublished: product.isPublished,
    featured: product.featured,
    category: toCategoryDTO(product.category),
  };
}

export function toProductCardDTO(product: ProductCard): ProductCardDTO {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrls: product.imageUrls,
    priceCents: product.priceCents,
    currency: product.currency,
    stockQty: product.stockQty,
    featured: product.featured,
    category: product.category,
  };
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

export type FullCartItem = { id: string; quantity: number; product: Product & { category: Category } };

export function toCartItemDTO(item: FullCartItem): CartItemDTO {
  return {
    id: item.id,
    product: toProductDTO(item.product),
    quantity: item.quantity,
    lineTotalCents: item.product.priceCents * item.quantity,
  };
}

export function toCartDTO(cart: { id: string; items: FullCartItem[] }): CartDTO {
  const items = cart.items.map(toCartItemDTO);
  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0);
  return {
    id: cart.id,
    items,
    subtotalCents,
    totalCents: subtotalCents,
    currency: items[0]?.product.currency ?? 'RWF',
  };
}

/** The cart repo's select omits lowStockThreshold/category — re-fetch full products. */
export async function cartWithFullProducts(cart: CartWithItems): Promise<{ id: string; items: FullCartItem[] }> {
  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, include: { category: true } })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    id: cart.id,
    items: cart.items.flatMap((i) => {
      const product = byId.get(i.productId);
      return product ? [{ id: i.id, quantity: i.quantity, product }] : [];
    }),
  };
}

// ---------------------------------------------------------------------------
// Orders / payments
// ---------------------------------------------------------------------------

export function toOrderItemDTO(item: OrderItem): OrderItemDTO {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    lineTotalCents: item.unitPriceCents * item.quantity,
  };
}

export function toOrderLineSummaryDTO(item: {
  productName: string;
  quantity: number;
  unitPriceCents: number;
}): OrderLineSummaryDTO {
  return {
    productName: item.productName,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: item.unitPriceCents * item.quantity,
  };
}

export function toPaymentDTO(payment: Payment): PaymentDTO {
  return {
    id: payment.id,
    orderId: payment.orderId,
    method: payment.method,
    status: payment.status,
    amountCents: payment.amountCents,
    currency: payment.currency,
    confirmedById: payment.confirmedById,
    confirmedAt: iso(payment.confirmedAt),
  };
}

export type OrderForDTO = Order & { items: OrderItem[]; payment: Payment | null };

export function toOrderDTO(order: OrderForDTO): OrderDTO {
  // Payment is always created with the order (1:1, same transaction in
  // createOrder); the fallback keeps this mapper total for any corrupt row.
  const method = order.payment?.method ?? 'COD_CASH';
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    method,
    items: order.items.map(toOrderItemDTO),
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    currency: order.currency,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    customerAddress: order.customerAddress,
    customerCity: order.customerCity,
    bankTransferReference: order.bankTransferReference,
    paidAt: iso(order.paidAt),
    fulfilledAt: iso(order.fulfilledAt),
    cancelledAt: iso(order.cancelledAt),
    createdAt: iso(order.createdAt) ?? '',
    payment: order.payment ? toPaymentDTO(order.payment) : null,
  };
}

/**
 * Row shape shared by the account order history (db listByUser) and the
 * admin order list (db listAllAdmin). Both selects fit this structurally.
 */
export type OrderListRow = {
  id: string;
  number: string;
  status: Order['status'];
  totalCents: number;
  currency: string;
  createdAt: Date;
  items: { productName: string; quantity: number; unitPriceCents: number }[];
  payment:
    | { method: Payment['method']; status: Payment['status']; confirmedAt?: Date | null }
    | null;
  customer?: { name: string; phone: string | null; email: string | null } | null;
};

export function toOrderListItemDTO(row: OrderListRow): OrderListItemDTO {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    method: row.payment?.method ?? 'COD_CASH',
    items: row.items.map(toOrderLineSummaryDTO),
    totalCents: row.totalCents,
    currency: row.currency,
    createdAt: iso(row.createdAt) ?? '',
    paymentStatus: row.payment?.status ?? 'PENDING',
    paymentConfirmedAt: iso(row.payment?.confirmedAt),
    customerName: row.customer?.name ?? null,
    customerPhone: row.customer?.phone ?? null,
    customerEmail: row.customer?.email ?? null,
  };
}

// ---------------------------------------------------------------------------
// Customers / analytics
// ---------------------------------------------------------------------------

export function toCustomerDTO(c: {
  id: string | null;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
}): CustomerDTO {
  return c;
}

export function toDashboardKpiDTO(kpis: OverviewKpis, currency: string): DashboardKpiDTO {
  return {
    totalRevenueCents: kpis.totalRevenueCents,
    orderCount: kpis.orderCount,
    avgOrderValueCents: kpis.avgOrderValueCents,
    lowStockCount: kpis.lowStockCount,
    pendingPaymentCount: kpis.pendingPaymentCount,
    currency,
  };
}

export function toSalesOverviewDTO(report: PeriodReport, currency: string): SalesOverviewDTO {
  return {
    periodStart: iso(report.from) ?? '',
    periodEnd: iso(report.to) ?? '',
    totalRevenueCents: report.revenueCents,
    ordersCount: report.orderCount,
    paidOrdersCount: report.paidOrderCount,
    averageOrderValueCents: report.avgOrderValueCents,
    currency,
    cancelledCount: report.cancelledCount,
    unitsSold: report.unitsSold,
    newCustomerCount: report.newCustomerCount,
  };
}

export function toMonthlyRevenueDTO(row: MonthlyRevenue): MonthlyRevenueDTO {
  return { month: row.month, revenueCents: row.revenueCents, orderCount: row.orderCount };
}

export function toTopProductDTO(row: TopProduct): TopProductDTO {
  return row;
}

export function toLowStockItemDTO(item: LowStockItem): LowStockItemDTO {
  return item;
}

export type MovementRow = {
  id: string;
  type: 'IN' | 'OUT';
  reason: 'RESTOCK' | 'ORDER' | 'ADJUSTMENT' | 'RETURN' | 'CANCEL';
  quantity: number;
  note: string | null;
  createdAt: Date;
  product: { name: string; slug: string };
  order: { number: string } | null;
};

export function toStockMovementDTO(row: MovementRow): StockMovementDTO {
  return {
    id: row.id,
    type: row.type,
    reason: row.reason,
    quantity: row.quantity,
    note: row.note,
    createdAt: iso(row.createdAt) ?? '',
    productName: row.product.name,
    productSlug: row.product.slug,
    orderNumber: row.order?.number ?? null,
  };
}
