/**
 * Notification EVENT WIRING — the actions that emit notifications, exercised
 * end-to-end through the REAL fail-soft lib helpers with a mocked prisma:
 * assertions land on the exact rows the helpers insert (titles, bodies,
 * links). Action deps (session, guards, next/cache, checkout/order/product
 * libs) are mocked; '@/lib/notifications' is NOT — the wiring under test is
 * "action input -> notification row".
 *
 * Covered:
 * - createOrderAction: NEW_ORDER to owners (COD + mobile money copy)
 * - createOrderAction BANK_TRANSFER: + PAYMENT_REVIEW with the reference
 * - admin order transitions: ORDER_STATUS to the customer (paid/on the way/
 *   cancelled/refunded) with /account/orders links; guest orders skip
 * - adjustStockAction + createProductAction: LOW_STOCK at/below threshold,
 *   silent above
 * - list/count/mark-read scoping (own rows only, IDOR-safe)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { createOrderAction } from "@/actions/checkout";
import { cancelOrderAction, confirmOrderPaymentAction, fulfillOrderAction, refundOrderAction } from "@/actions/admin/orders";
import { adjustStockAction } from "@/actions/admin/stock";
import { createProductAction } from "@/actions/admin/products";
import {
  getUnreadNotificationsCountAction,
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";

// --- hoisted state (vi.mock factories run before any const below) ----------

type NotificationRow = { userId: string; type: string; title: string; body: string | null; link: string | null };

type MockPrisma = {
  notification: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  user: { findMany: ReturnType<typeof vi.fn> };
};

const m = vi.hoisted(() => {
  const prisma = {
    notification: {
      create: vi.fn(async (args: unknown) => args),
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    user: {
      findMany: vi.fn(async () => []),
    },
  } as unknown as MockPrisma;
  const OWNER: User = {
    id: "owner-1",
    email: "owner@zubeli.rw",
    passwordHash: "h",
    name: "Owner",
    phone: null,
    role: "OWNER",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const CUSTOMER: User = {
    id: "user-customer",
    email: "alice@zubeli.rw",
    passwordHash: "h",
    name: "Alice",
    phone: "+250788123456",
    role: "CUSTOMER",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const ORDER_ROW: {
    id: string;
    number: string;
    customerId: string | null;
    status: string;
    items: unknown[];
    subtotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
    currency: string;
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    customerAddress: string;
    customerCity: string | null;
    bankTransferReference: string | null;
    paidAt: Date | null;
    fulfilledAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    payment: {
      id: string;
      orderId: string;
      method: string;
      status: string;
      amountCents: number;
      currency: string;
      providerPaymentId: string | null;
      confirmedById: string | null;
      confirmedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    };
  } = {
    id: "order-1",
    number: "ZBL-00000001",
    customerId: "user-customer",
    status: "PENDING",
    items: [],
    subtotalCents: 32000,
    deliveryFeeCents: 2000,
    totalCents: 34000,
    currency: "RWF",
    customerName: "Alice",
    customerPhone: "+250788123456",
    customerEmail: null,
    customerAddress: "KN 5 Rd",
    customerCity: "Kigali",
    bankTransferReference: null,
    paidAt: null,
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    payment: { id: "pay-1", orderId: "order-1", method: "COD_CASH", status: "PENDING", amountCents: 34000, currency: "RWF", providerPaymentId: null, confirmedById: null, confirmedAt: null, createdAt: new Date(), updatedAt: new Date() },
  };
  const PRODUCT_ROW: {
    id: string;
    name: string;
    slug: string;
    stockQty: number;
    lowStockThreshold: number;
    category: { id: string; slug: string; name: string };
  } = {
    id: "prod-1",
    name: "Safety Vest",
    slug: "safety-vest",
    stockQty: 3,
    lowStockThreshold: 5,
    category: { id: "cat-1", slug: "safety", name: "Safety" },
  };
  return { prisma, OWNER, CUSTOMER, ORDER_ROW, PRODUCT_ROW };
});

vi.mock("@/lib/db", () => ({ prisma: m.prisma }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn(async () => m.CUSTOMER),
  getSession: vi.fn(async () => m.CUSTOMER),
}));
vi.mock("@/lib/auth/guards", () => ({ requireAdminOrThrow: vi.fn(async () => m.OWNER) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/cart", () => ({
  ensureCart: vi.fn(async () => ({ id: "cart-1" })),
  getCart: vi.fn(async () => null),
}));
vi.mock("@/lib/orders", () => ({
  buildCheckoutContext: vi.fn(async () => ({ items: [{ productId: "p-1", quantity: 1 }] })),
  placeOrder: vi.fn(async () => ({ order: m.ORDER_ROW, paymentInstructions: { title: "Cash on delivery", steps: [] } })),
}));
vi.mock("@/lib/request", () => ({ clientIp: vi.fn(async () => "127.0.0.1") }));
vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn(async () => undefined),
  RATE_LIMITS: { login: {}, register: {}, checkout: {} },
}));
vi.mock("@/lib/orders-admin", () => ({
  confirmOrderPayment: vi.fn(async () => m.ORDER_ROW),
  fulfillOrder: vi.fn(async () => m.ORDER_ROW),
  cancelOrder: vi.fn(async () => m.ORDER_ROW),
  refundOrder: vi.fn(async () => m.ORDER_ROW),
}));
vi.mock("@/lib/products-admin", () => ({
  adjustStock: vi.fn(async () => m.PRODUCT_ROW),
  createProduct: vi.fn(async () => m.PRODUCT_ROW),
}));

/** All notification.create calls flattened to their data payloads. */
function createdNotifications(): NotificationRow[] {
  return m.prisma.notification.create.mock.calls.map((call) => (call[0] as { data: NotificationRow }).data);
}

function createdByType(type: string): NotificationRow[] {
  return createdNotifications().filter((n) => n.type === type);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.notification.create.mockImplementation(async (args: unknown) => args);
  m.prisma.notification.findMany.mockImplementation(async () => []);
  m.prisma.notification.count.mockImplementation(async () => 0);
  m.prisma.notification.updateMany.mockImplementation(async () => ({ count: 1 }));
  m.prisma.user.findMany.mockImplementation(async () => [{ id: "owner-1" }, { id: "owner-2" }]);
  // reset mutated fixtures
  m.ORDER_ROW.customerId = "user-customer";
  m.ORDER_ROW.payment.method = "COD_CASH";
  m.ORDER_ROW.bankTransferReference = null;
  m.PRODUCT_ROW.stockQty = 3;
});

// --- createOrderAction: NEW_ORDER + PAYMENT_REVIEW --------------------------

describe("createOrderAction notification wiring", () => {
  it("notifies every owner with NEW_ORDER (copy + RWF total + admin link)", async () => {
    const res = await createOrderAction({
      customer: { name: "Alice", phone: "+250788123456", address: "KN 5 Rd", city: "Kigali" },
      paymentMethod: "COD_CASH",
    });
    expect(res.ok).toBe(true);

    const newOrders = createdByType("NEW_ORDER");
    expect(newOrders).toHaveLength(2); // one row per owner
    expect(newOrders[0]).toMatchObject({
      userId: "owner-1",
      title: "New order ZBL-00000001",
      body: "Cash on delivery for 34,000 RWF",
      link: "/admin/orders/order-1",
    });
    expect(newOrders[1]!.userId).toBe("owner-2");
    expect(createdByType("PAYMENT_REVIEW")).toHaveLength(0);
  });

  it("emits NEW_ORDER for mobile money with the correct method copy", async () => {
    m.ORDER_ROW.payment.method = "COD_MOBILE_MONEY";
    await createOrderAction({
      customer: { name: "Alice", phone: "+250788123456", address: "KN 5 Rd", city: "Kigali" },
      paymentMethod: "COD_MOBILE_MONEY",
    });
    expect(createdByType("NEW_ORDER")[0]!.body).toBe("Mobile money on delivery for 34,000 RWF");
  });

  it("adds PAYMENT_REVIEW with the bank-transfer reference for BANK_TRANSFER", async () => {
    m.ORDER_ROW.payment.method = "BANK_TRANSFER";
    m.ORDER_ROW.bankTransferReference = "TRF-8820136";
    await createOrderAction({
      customer: { name: "Alice", phone: "+250788123456", address: "KN 5 Rd", city: "Kigali" },
      paymentMethod: "BANK_TRANSFER",
      bankTransferReference: "TRF-8820136",
    });

    const reviews = createdByType("PAYMENT_REVIEW");
    expect(reviews).toHaveLength(2);
    expect(reviews[0]).toMatchObject({
      title: "Bank-transfer payment to verify",
      body: "Reference TRF-8820136 on order ZBL-00000001",
      link: "/admin/orders/order-1",
    });
  });

  it("a notification failure never breaks order placement (fail-soft, ok stays true)", async () => {
    m.prisma.notification.create.mockRejectedValue(new Error("db down"));
    m.prisma.user.findMany.mockRejectedValue(new Error("db down"));
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await createOrderAction({
      customer: { name: "Alice", phone: "+250788123456", address: "KN 5 Rd", city: "Kigali" },
      paymentMethod: "COD_CASH",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.order.id).toBe("order-1");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// --- admin order transitions: ORDER_STATUS to the customer ------------------

describe("admin order transition wiring", () => {
  it("confirmOrderPaymentAction: 'paid' with Payment confirmed + account link", async () => {
    const res = await confirmOrderPaymentAction({ orderId: "order-1" });
    expect(res.ok).toBe(true);
    expect(createdByType("ORDER_STATUS")).toHaveLength(1);
    expect(createdNotifications()[0]).toMatchObject({
      userId: "user-customer",
      title: "Order ZBL-00000001 paid",
      body: "Payment confirmed",
      link: "/account/orders/order-1",
    });
  });

  it("fulfillOrderAction: 'on the way'", async () => {
    await fulfillOrderAction({ orderId: "order-1" });
    expect(createdNotifications()[0]).toMatchObject({
      title: "Order ZBL-00000001 on the way",
      body: "Your order is on the way",
    });
  });

  it("cancelOrderAction: 'cancelled'", async () => {
    await cancelOrderAction({ orderId: "order-1" });
    expect(createdNotifications()[0]).toMatchObject({
      title: "Order ZBL-00000001 cancelled",
      body: "Your order has been cancelled",
    });
  });

  it("refundOrderAction: 'refunded'", async () => {
    await refundOrderAction({ orderId: "order-1" });
    expect(createdNotifications()[0]).toMatchObject({
      title: "Order ZBL-00000001 refunded",
      body: "Your order has been refunded",
    });
  });

  it("guest orders (no userId) create nothing", async () => {
    m.ORDER_ROW.customerId = null;
    const res = await confirmOrderPaymentAction({ orderId: "order-1" });
    expect(res.ok).toBe(true);
    expect(m.prisma.notification.create).not.toHaveBeenCalled();
  });
});

// --- LOW_STOCK wiring ---------------------------------------------------------

describe("LOW_STOCK wiring", () => {
  it("adjustStockAction notifies owners when the RESULTING qty is at/below threshold", async () => {
    const res = await adjustStockAction({ productId: "prod-1", direction: "OUT", quantity: 1, reason: "ADJUSTMENT" });
    expect(res.ok).toBe(true);
    expect(createdByType("LOW_STOCK")).toHaveLength(2);
    expect(createdByType("LOW_STOCK")[0]).toMatchObject({
      title: "Low stock: Safety Vest",
      body: "Only 3 left (threshold 5)",
      link: "/admin/stock",
    });
  });

  it("adjustStockAction stays silent above the threshold", async () => {
    m.PRODUCT_ROW.stockQty = 10;
    await adjustStockAction({ productId: "prod-1", direction: "OUT", quantity: 1, reason: "ADJUSTMENT" });
    expect(createdByType("LOW_STOCK")).toHaveLength(0);
  });

  it("createProductAction notifies when the initial stock is at/below threshold", async () => {
    await createProductAction({ name: "Safety Vest", slug: "safety-vest", priceCents: 5000, categoryId: "cat-1", stockQty: 3, lowStockThreshold: 5, isPublished: true, featured: false, imageUrls: [] });
    expect(createdByType("LOW_STOCK")).toHaveLength(2);
    expect(createdByType("LOW_STOCK")[0]!.title).toBe("Low stock: Safety Vest");
  });

  it("createProductAction stays silent above the threshold", async () => {
    m.PRODUCT_ROW.stockQty = 20;
    await createProductAction({
      name: "Hammer", slug: "hammer", priceCents: 10000, categoryId: "cat-1", stockQty: 20, lowStockThreshold: 5, isPublished: true, featured: false, imageUrls: [],
    });
    expect(createdByType("LOW_STOCK")).toHaveLength(0);
  });
});

// --- notifications actions: own rows only (IDOR-safe) ----------------------------

describe("notification actions (customer + owner)", () => {
  it("listNotificationsAction scopes to the session user, newest first + take+1 pagination", async () => {
    m.prisma.notification.findMany.mockImplementation(async () => [
      { id: "n1", userId: "user-customer", type: "NEW_ORDER", title: "a", body: null, link: null, readAt: null, createdAt: new Date("2026-08-09T09:00:00.000Z") },
      { id: "n2", userId: "user-customer", type: "NEW_ORDER", title: "b", body: null, link: null, readAt: null, createdAt: new Date("2026-08-09T08:00:00.000Z") },
      { id: "n3", userId: "user-customer", type: "NEW_ORDER", title: "c", body: null, link: null, readAt: null, createdAt: new Date("2026-08-09T07:00:00.000Z") },
    ]);
    const res = await listNotificationsAction({ limit: 2 });
    expect(res.ok).toBe(true);
    expect(m.prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: "user-customer" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 3,
    });
    if (res.ok) {
      expect(res.data.items).toHaveLength(2);
      expect(res.data.items[0]).toMatchObject({ id: "n1", createdAt: "2026-08-09T09:00:00.000Z" });
      expect(res.data.nextCursor).toBe("n2");
      expect(res.data.hasMore).toBe(true);
    }
  });

  it("listNotificationsAction respects the bounded limit (take 51 for 50)", async () => {
    await listNotificationsAction({ limit: 50 });
    expect(m.prisma.notification.findMany.mock.calls[0]![0]!.take).toBe(51);
  });

  it("listNotificationsAction rejects limits above 50 (VALIDATION)", async () => {
    const res = await listNotificationsAction({ limit: 99 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION");
    expect(m.prisma.notification.findMany).not.toHaveBeenCalled();
  });

  it("getUnreadNotificationsCountAction counts only unread rows for the user", async () => {
    m.prisma.notification.count.mockImplementation(async () => 3);
    const res = await getUnreadNotificationsCountAction();
    expect(m.prisma.notification.count).toHaveBeenCalledWith({ where: { userId: "user-customer", readAt: null } });
    expect(res.ok && res.data.count).toBe(3);
  });

  it("markNotificationReadAction updates ONLY the user's own row (id + userId)", async () => {
    const res = await markNotificationReadAction({ notificationId: "n1" });
    expect(res.ok).toBe(true);
    expect(m.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "n1", userId: "user-customer" },
      data: { readAt: expect.any(Date) },
    });
  });

  it("markNotificationReadAction 404s when the row is not the user's (count 0)", async () => {
    m.prisma.notification.updateMany.mockImplementation(async () => ({ count: 0 }));
    const res = await markNotificationReadAction({ notificationId: "someone-elses" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_FOUND");
  });

  it("markAllNotificationsReadAction updates all of the user's rows", async () => {
    const res = await markAllNotificationsReadAction();
    expect(res.ok).toBe(true);
    expect(m.prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-customer" },
      data: { readAt: expect.any(Date) },
    });
  });
});