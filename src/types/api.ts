/**
 * Zubeli — shared API contract (ADR 0004).
 * Single source of truth for the server actions, the health route and every
 * screen agent. Pure types only: no runtime code, no server-only imports —
 * this file ships to the client bundle untouched.
 *
 * Conventions:
 * - Money is always an integer in minor units (RWF: 1 minor unit = 1 RWF).
 * - Dates are ISO-8601 strings, never Date objects.
 * - Raw Prisma models never cross this boundary (api-design skill).
 */

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'NOT_AUTHORIZED'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'OUT_OF_STOCK'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'CONFLICT'
  | 'INTERNAL'
  // POST /api/admin/upload codes — fixed contract, consumed by the product form.
  | 'UPLOAD_FAILED'
  | 'UPLOAD_TOO_LARGE'
  | 'UPLOAD_TYPE_REJECTED'
  | 'UNAUTHORIZED';

export type ApiError = {
  code: ErrorCode;
  message: string;
  /** Machine-readable context only (e.g. `{ fieldErrors }`, `{ productId }`) — never stack traces. */
  details?: unknown;
};

/** Returned by every server action. Never throw across the action boundary except `redirect()`. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * POST /api/admin/upload response (guarded admin image upload, backend-agent).
 * `data.url` is a LOCAL path (`/uploads/products/<uuid>.<ext>`) — prefix with
 * the site origin when displaying, never an absolute URL.
 */
export type UploadResult = ActionResult<{ url: string }>;

/** Cursor pagination envelope — used by every list action (ADR 0004). */
export type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

// ---------------------------------------------------------------------------
// Prisma enum mirrors (client-safe string unions)
// ---------------------------------------------------------------------------

export type Role = 'CUSTOMER' | 'OWNER';
export type OrderStatus = 'PENDING' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod =
  | 'COD_CASH'
  | 'COD_MOBILE_MONEY'
  | 'BANK_TRANSFER'
  | 'MOMO_GATEWAY' // reserved — no provider in the MVP (ADR 0003)
  | 'CARD'; // reserved — no provider in the MVP (ADR 0003)
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
export type InventoryMovementType = 'IN' | 'OUT';
export type InventoryReason = 'RESTOCK' | 'ORDER' | 'ADJUSTMENT' | 'RETURN' | 'CANCEL';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

export type UserDTO = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
};

export type CategoryDTO = {
  id: string;
  slug: string;
  name: string;
};

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  priceCents: number;
  currency: string;
  stockQty: number;
  lowStockThreshold: number;
  isPublished: boolean;
  featured: boolean;
  category: CategoryDTO;
};

/** Storefront card (catalog / featured / search) — lighter than ProductDTO. */
export type ProductCardDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  priceCents: number;
  currency: string;
  stockQty: number;
  featured: boolean;
  category: { slug: string; name: string };
};

export type CartItemDTO = {
  id: string;
  product: ProductDTO;
  quantity: number;
  lineTotalCents: number; // derived: product.priceCents × quantity
};

export type CartDTO = {
  id: string;
  items: CartItemDTO[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number; // derived: subtotal + delivery
  currency: string;
};

export type OrderItemDTO = {
  id: string;
  productId: string | null; // null after product hard-delete (snapshot survives)
  productName: string; // snapshot
  unitPriceCents: number; // snapshot
  quantity: number;
  lineTotalCents: number; // derived: unitPriceCents × quantity
};

export type PaymentDTO = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentStatus;
  amountCents: number;
  currency: string;
  confirmedById: string | null; // owner who manually confirmed (null in MVP)
  confirmedAt: string | null;
};

/** Pay-on-delivery instructions shown on checkout success + order pages (ADR 0003). */
export type PaymentInstructions = { title: string; steps: string[] };

/** createOrderAction result — order + the display instructions for its method. */
export type CheckoutResult = { order: OrderDTO; paymentInstructions: PaymentInstructions };

export type OrderDTO = {
  id: string;
  number: string; // display + bank-transfer reference, ZBL-XXXXXXXX
  status: OrderStatus;
  method: PaymentMethod;
  items: OrderItemDTO[];
  subtotalCents: number;
  deliveryFeeCents: number; // snapshot at checkout
  totalCents: number;
  currency: string;
  customerName: string; // snapshot
  customerPhone: string; // snapshot
  customerEmail: string | null; // snapshot
  customerAddress: string; // snapshot
  customerCity: string | null; // snapshot
  bankTransferReference: string | null;
  paidAt: string | null;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  payment: PaymentDTO | null;
  /** Only populated by order-detail actions (checkout result + account/admin detail). */
  paymentInstructions?: PaymentInstructions | null;
};

/** List-row shape for account order history + admin order list (additive to ADR 0004). */
export type OrderListItemDTO = {
  id: string;
  number: string;
  status: OrderStatus;
  method: PaymentMethod;
  items: OrderLineSummaryDTO[];
  totalCents: number;
  currency: string;
  createdAt: string;
  paymentStatus: PaymentStatus;
  paymentConfirmedAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
};

export type OrderLineSummaryDTO = {
  productName: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number; // derived
};

/**
 * Derived from User + Order aggregates (ADR 0004).
 * Guests appear as order-snapshot customers with `id: null`.
 */
export type CustomerDTO = {
  id: string | null;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number; // all orders (any status)
  totalSpentCents: number; // PAID + FULFILLED only — PENDING is not revenue
  lastOrderAt: string | null;
};

export type DashboardKpiDTO = {
  totalRevenueCents: number; // PAID + FULFILLED
  orderCount: number; // all orders
  avgOrderValueCents: number;
  lowStockCount: number;
  pendingPaymentCount: number;
  currency: string;
};

export type SalesOverviewDTO = {
  periodStart: string;
  periodEnd: string;
  totalRevenueCents: number; // PAID + FULFILLED only
  ordersCount: number;
  paidOrdersCount: number;
  averageOrderValueCents: number;
  currency: string;
  cancelledCount?: number;
  unitsSold?: number;
  newCustomerCount?: number;
};

export type MonthlyRevenueDTO = {
  month: string; // 'YYYY-MM'
  revenueCents: number;
  orderCount: number;
};

export type TopProductDTO = {
  productId: string | null;
  productName: string | null;
  revenueCents: number;
  unitsSold: number;
};

/** Inventory ledger row (dashboard stock screen) — additive to ADR 0004. */
export type StockMovementDTO = {
  id: string;
  type: InventoryMovementType;
  reason: InventoryReason;
  quantity: number;
  note: string | null;
  createdAt: string;
  productName: string;
  productSlug: string;
  orderNumber: string | null;
};

export type LowStockItemDTO = {
  id: string;
  name: string;
  slug: string;
  stockQty: number;
  lowStockThreshold: number;
  categoryName: string;
};
