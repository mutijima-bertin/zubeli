/**
 * DTO mapping layer (src/lib/dto.ts, ADR 0004) — raw Prisma models never
 * cross the boundary. Behaviors under test:
 * - date → ISO string conversion (nulls stay null)
 * - money stays integer minor units; derived line totals / subtotals / totals
 * - order DTO snapshot mapping (status, method from payment, references, timestamps)
 * - fallbacks for corrupt rows (missing payment → COD_CASH / PENDING)
 *
 * NOTE: formatRWF is NOT yet implemented — it is planned for src/lib/format.ts
 * (frontend-agent deliverable, see docs/plans/mvp-demo-plan.md). Reported as a
 * gap; the mapper tests below cover everything that exists in dto.ts today.
 */
import { describe, expect, it, vi } from "vitest";
import type { Category, Order, OrderItem, Payment, Product, User } from "@prisma/client";
import type { ProductCard } from "@/lib/db/products";
import {
  cartWithFullProducts,
  toCartDTO,
  toCartItemDTO,
  toCategoryDTO,
  toCustomerDTO,
  toDashboardKpiDTO,
  toLowStockItemDTO,
  toMonthlyRevenueDTO,
  toOrderDTO,
  toOrderItemDTO,
  toOrderListItemDTO,
  toPaymentDTO,
  toProductCardDTO,
  toProductDTO,
  toSalesOverviewDTO,
  toStockMovementDTO,
  toTopProductDTO,
  toUserDTO,
  type FullCartItem,
  type OrderListRow,
  type MovementRow,
} from "@/lib/dto";

// --- mocks -----------------------------------------------------------------

const m = vi.hoisted(() => {
  const client = {
    product: { findMany: vi.fn(async (): Promise<unknown[]> => []) },
  };
  return { client };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

// --- fixtures --------------------------------------------------------------

const now = new Date("2026-08-05T10:00:00.000Z");

function categoryFixture(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat-1",
    name: "Hand Tools",
    slug: "hand-tools",
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    name: "Hammer 16oz",
    slug: "hammer-16oz",
    description: "A solid hammer",
    imageUrls: ["/images/products/hammer.svg"],
    priceCents: 15000,
    currency: "RWF",
    stockQty: 8,
    lowStockThreshold: 3,
    isPublished: true,
    featured: true,
    categoryId: "cat-1",
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function userFixture(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "alice@zubeli.rw",
    passwordHash: "hash",
    name: "Umutoni Alice",
    phone: "+250788123456",
    role: "CUSTOMER",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function paymentFixture(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    orderId: "order-1",
    method: "COD_CASH",
    status: "PENDING",
    amountCents: 32000,
    currency: "RWF",
    providerPaymentId: null,
    confirmedById: null,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function orderItemFixture(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    productId: "prod-1",
    productName: "Hammer 16oz",
    unitPriceCents: 15000,
    quantity: 2,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function orderFixture(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    number: "ZBL-00000001",
    status: "PENDING",
    customerId: null,
    customerName: "Umutoni Alice",
    customerPhone: "+250788123456",
    customerEmail: "alice@zubeli.rw",
    customerAddress: "KN 5 Rd, Kigali",
    customerCity: "Kigali",
    subtotalCents: 30000,
    deliveryFeeCents: 2000,
    totalCents: 32000,
    currency: "RWF",
    bankTransferReference: null,
    idempotencyKey: "cart-1",
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// --- users / categories / products ------------------------------------------

describe("user/category/product mappers", () => {
  it("toUserDTO maps the public shape only (no passwordHash)", () => {
    expect(toUserDTO(userFixture())).toEqual({
      id: "user-1",
      email: "alice@zubeli.rw",
      name: "Umutoni Alice",
      phone: "+250788123456",
      role: "CUSTOMER",
    });
  });

  it("toCategoryDTO maps id/slug/name", () => {
    expect(toCategoryDTO(categoryFixture())).toEqual({ id: "cat-1", slug: "hand-tools", name: "Hand Tools" });
  });

  it("toProductDTO maps the full product with nested category", () => {
    const product = productFixture();
    expect(toProductDTO({ ...product, category: categoryFixture() })).toEqual({
      id: "prod-1",
      slug: "hammer-16oz",
      name: "Hammer 16oz",
      description: "A solid hammer",
      imageUrls: ["/images/products/hammer.svg"],
      priceCents: 15000,
      currency: "RWF",
      stockQty: 8,
      lowStockThreshold: 3,
      isPublished: true,
      featured: true,
      category: { id: "cat-1", slug: "hand-tools", name: "Hand Tools" },
    });
  });

  it("toProductCardDTO maps the lighter card shape", () => {
    const product = productFixture();
    const dto = toProductCardDTO({
      ...product,
      category: { slug: "hand-tools", name: "Hand Tools" },
    } as unknown as ProductCard);
    expect(dto).toMatchObject({
      id: "prod-1",
      priceCents: 15000,
      stockQty: 8,
      featured: true,
      category: { slug: "hand-tools", name: "Hand Tools" },
    });
    expect(dto).not.toHaveProperty("lowStockThreshold");
    expect(dto).not.toHaveProperty("isPublished");
  });
});

// --- cart ------------------------------------------------------------------

describe("cart mappers", () => {
  const fullItem = (overrides: Partial<FullCartItem> = {}): FullCartItem => ({
    id: "ci-1",
    quantity: 2,
    product: { ...productFixture(), category: categoryFixture() },
    ...overrides,
  });

  it("toCartItemDTO derives lineTotalCents = priceCents × quantity", () => {
    expect(toCartItemDTO(fullItem())).toEqual({
      id: "ci-1",
      product: expect.objectContaining({ id: "prod-1" }),
      quantity: 2,
      lineTotalCents: 30000,
    });
  });

  it("toCartDTO sums subtotal and total including the delivery fee", () => {
    const dto = toCartDTO(
      { id: "cart-1", items: [fullItem(), fullItem({ id: "ci-2", quantity: 1, product: { ...productFixture({ id: "prod-2", priceCents: 8000 }), category: categoryFixture() } })] },
      2000,
    );
    expect(dto.subtotalCents).toBe(30000 + 8000);
    expect(dto.deliveryFeeCents).toBe(2000);
    expect(dto.totalCents).toBe(40000);
    expect(dto.currency).toBe("RWF");
  });

  it("toCartDTO handles an empty cart (subtotal 0, currency falls back to RWF)", () => {
    const dto = toCartDTO({ id: "cart-1", items: [] }, 2000);
    expect(dto).toEqual({ id: "cart-1", items: [], subtotalCents: 0, deliveryFeeCents: 2000, totalCents: 2000, currency: "RWF" });
  });

  it("cartWithFullProducts re-fetches products and drops items whose product vanished", async () => {
    const cart = {
      id: "cart-1",
      items: [
        { id: "ci-1", cartId: "cart-1", productId: "prod-1", quantity: 2, createdAt: now, updatedAt: now },
        { id: "ci-2", cartId: "cart-1", productId: "prod-missing", quantity: 1, createdAt: now, updatedAt: now },
      ],
    };
    m.client.product.findMany.mockResolvedValue([{ ...productFixture(), category: categoryFixture() }]);
    const full = await cartWithFullProducts(cart as never);
    expect(m.client.product.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["prod-1", "prod-missing"] } },
      include: { category: true },
    });
    expect(full.items).toHaveLength(1);
    expect(full.items[0]!.id).toBe("ci-1");
    expect(full.items[0]!.product.id).toBe("prod-1");
  });
});

// --- orders / payments ------------------------------------------------------

describe("order mappers", () => {
  it("toOrderItemDTO derives lineTotalCents from the snapshot", () => {
    expect(toOrderItemDTO(orderItemFixture())).toEqual({
      id: "item-1",
      productId: "prod-1",
      productName: "Hammer 16oz",
      unitPriceCents: 15000,
      quantity: 2,
      lineTotalCents: 30000,
    });
  });

  it("toPaymentDTO maps dates to ISO strings", () => {
    expect(toPaymentDTO(paymentFixture({ confirmedAt: now, confirmedById: "admin-1" }))).toEqual({
      id: "pay-1",
      orderId: "order-1",
      method: "COD_CASH",
      status: "PENDING",
      amountCents: 32000,
      currency: "RWF",
      confirmedById: "admin-1",
      confirmedAt: "2026-08-05T10:00:00.000Z",
    });
  });

  it("toPaymentDTO keeps null confirmedAt as null", () => {
    expect(toPaymentDTO(paymentFixture()).confirmedAt).toBeNull();
  });

  it("toOrderDTO maps the full order snapshot with ISO timestamps", () => {
    const order = orderFixture({
      status: "PAID",
      bankTransferReference: "TRF-8820136",
      paidAt: now,
      fulfilledAt: null,
      cancelledAt: null,
    });
    const dto = toOrderDTO({
      ...order,
      items: [orderItemFixture()],
      payment: paymentFixture({ method: "BANK_TRANSFER", status: "PAID" }),
    });
    expect(dto).toMatchObject({
      id: "order-1",
      number: "ZBL-00000001",
      status: "PAID",
      method: "BANK_TRANSFER",
      subtotalCents: 30000,
      deliveryFeeCents: 2000,
      totalCents: 32000,
      currency: "RWF",
      customerName: "Umutoni Alice",
      customerPhone: "+250788123456",
      customerEmail: "alice@zubeli.rw",
      customerAddress: "KN 5 Rd, Kigali",
      customerCity: "Kigali",
      bankTransferReference: "TRF-8820136",
      paidAt: "2026-08-05T10:00:00.000Z",
      fulfilledAt: null,
      cancelledAt: null,
      createdAt: "2026-08-05T10:00:00.000Z",
    });
    expect(dto.items).toHaveLength(1);
    expect(dto.payment).toMatchObject({ method: "BANK_TRANSFER", status: "PAID" });
  });

  it("toOrderDTO falls back to COD_CASH when the payment row is missing (corrupt row)", () => {
    const dto = toOrderDTO({ ...orderFixture(), items: [], payment: null });
    expect(dto.method).toBe("COD_CASH");
    expect(dto.payment).toBeNull();
  });

  it("toOrderListItemDTO maps the list row with payment summary", () => {
    const row: OrderListRow = {
      id: "order-1",
      number: "ZBL-00000001",
      status: "PAID",
      totalCents: 32000,
      currency: "RWF",
      createdAt: now,
      items: [{ productName: "Hammer 16oz", quantity: 2, unitPriceCents: 15000 }],
      payment: { method: "BANK_TRANSFER", status: "PAID", confirmedAt: now },
      customer: { name: "Umutoni Alice", phone: "+250788123456", email: "alice@zubeli.rw" },
    };
    expect(toOrderListItemDTO(row)).toEqual({
      id: "order-1",
      number: "ZBL-00000001",
      status: "PAID",
      method: "BANK_TRANSFER",
      items: [{ productName: "Hammer 16oz", quantity: 2, unitPriceCents: 15000, lineTotalCents: 30000 }],
      totalCents: 32000,
      currency: "RWF",
      createdAt: "2026-08-05T10:00:00.000Z",
      paymentStatus: "PAID",
      paymentConfirmedAt: "2026-08-05T10:00:00.000Z",
      customerName: "Umutoni Alice",
      customerPhone: "+250788123456",
      customerEmail: "alice@zubeli.rw",
    });
  });

  it("toOrderListItemDTO tolerates a missing payment (COD_CASH / PENDING fallbacks)", () => {
    const row: OrderListRow = {
      id: "order-1",
      number: "ZBL-00000001",
      status: "PENDING",
      totalCents: 32000,
      currency: "RWF",
      createdAt: now,
      items: [],
      payment: null,
      customer: null,
    };
    const dto = toOrderListItemDTO(row);
    expect(dto.method).toBe("COD_CASH");
    expect(dto.paymentStatus).toBe("PENDING");
    expect(dto.paymentConfirmedAt).toBeNull();
    expect(dto.customerName).toBeNull();
  });
});

// --- customers / analytics / stock ------------------------------------------

describe("analytics and stock mappers", () => {
  it("toCustomerDTO passes the aggregate through", () => {
    const c = { id: "user-1", name: "Umutoni Alice", phone: "+250788123456", email: "alice@zubeli.rw", ordersCount: 3, totalSpentCents: 96000, lastOrderAt: "2026-08-05T10:00:00.000Z" };
    expect(toCustomerDTO(c)).toEqual(c);
  });

  it("toDashboardKpiDTO maps KPI fields + currency", () => {
    const dto = toDashboardKpiDTO(
      { totalRevenueCents: 96000, orderCount: 3, avgOrderValueCents: 32000, lowStockCount: 4, pendingPaymentCount: 2 },
      "RWF",
    );
    expect(dto).toEqual({ totalRevenueCents: 96000, orderCount: 3, avgOrderValueCents: 32000, lowStockCount: 4, pendingPaymentCount: 2, currency: "RWF" });
  });

  it("toSalesOverviewDTO maps the period report with ISO range", () => {
    const dto = toSalesOverviewDTO(
      { from: now, to: now, revenueCents: 96000, orderCount: 3, paidOrderCount: 3, avgOrderValueCents: 32000, cancelledCount: 0, unitsSold: 6, newCustomerCount: 1 },
      "RWF",
    );
    expect(dto).toMatchObject({
      periodStart: "2026-08-05T10:00:00.000Z",
      periodEnd: "2026-08-05T10:00:00.000Z",
      totalRevenueCents: 96000,
      ordersCount: 3,
      paidOrdersCount: 3,
      averageOrderValueCents: 32000,
      currency: "RWF",
      cancelledCount: 0,
      unitsSold: 6,
      newCustomerCount: 1,
    });
  });

  it("toMonthlyRevenueDTO / toTopProductDTO / toLowStockItemDTO pass rows through", () => {
    expect(toMonthlyRevenueDTO({ month: "2026-07", revenueCents: 64000, orderCount: 2 })).toEqual({ month: "2026-07", revenueCents: 64000, orderCount: 2 });
    expect(toTopProductDTO({ productId: "prod-1", productName: "Hammer", revenueCents: 96000, unitsSold: 6 })).toEqual({ productId: "prod-1", productName: "Hammer", revenueCents: 96000, unitsSold: 6 });
    expect(toLowStockItemDTO({ id: "prod-1", name: "Hammer", slug: "hammer", stockQty: 2, lowStockThreshold: 3, categoryName: "Hand Tools" })).toEqual({ id: "prod-1", name: "Hammer", slug: "hammer", stockQty: 2, lowStockThreshold: 3, categoryName: "Hand Tools" });
  });

  it("toStockMovementDTO maps ledger rows with ISO date and optional order", () => {
    const row: MovementRow = {
      id: "mv-1",
      type: "OUT",
      reason: "ORDER",
      quantity: 2,
      note: "Order ZBL-00000001",
      createdAt: now,
      product: { name: "Hammer 16oz", slug: "hammer-16oz" },
      order: { number: "ZBL-00000001" },
    };
    expect(toStockMovementDTO(row)).toEqual({
      id: "mv-1",
      type: "OUT",
      reason: "ORDER",
      quantity: 2,
      note: "Order ZBL-00000001",
      createdAt: "2026-08-05T10:00:00.000Z",
      productName: "Hammer 16oz",
      productSlug: "hammer-16oz",
      orderNumber: "ZBL-00000001",
    });
    expect(toStockMovementDTO({ ...row, order: null }).orderNumber).toBeNull();
  });
});
