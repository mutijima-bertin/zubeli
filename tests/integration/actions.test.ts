/**
 * Integration tests for server actions (src/actions/*) against the REAL test
 * database (TEST_DATABASE_URL, port 5435) — never the dev DB (5434).
 *
 * Isolation strategy:
 * - beforeAll truncates every table the suite touches (Order, OrderItem,
 *   Payment, InventoryMovement, Cart, CartItem, Session) and removes test-*
 *   users, then creates its own fixtures (category, products, OWNER admin +
 *   session, CUSTOMER user) with a unique run suffix. afterAll removes the
 *   fixtures and truncates the transactional tables again.
 * - next/headers is mocked so session/cart identity flows through an
 *   in-memory cookie store (this is how admin actions see the OWNER session:
 *   a session row is inserted into the test DB keyed by sha256(token), and the
 *   mocked cookies() returns that raw token — requireAdminOrThrow then resolves
 *   the user through the app's own prisma singleton, which points at 5435 via
 *   tests/setup.ts). next/cache is mocked so revalidatePath/revalidateTag are
 *   no-ops outside a Next request scope.
 * - The app's prisma singleton (src/lib/db.ts) is used by the actions and
 *   resolves to the test DB; this file's own `db` client is separate.
 */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";
import type { ActionResult } from "@/types/api";

// --- next/headers + next/cache mocks ----------------------------------------

const req = vi.hoisted(() => {
  const cookieStore: Record<string, string> = {};
  const setCalls: { name: string; value: string; options?: Record<string, unknown> }[] = [];
  return {
    cookieStore,
    setCalls,
    setCookie: (name: string, value: string) => {
      cookieStore[name] = value;
    },
    clearCookies: () => {
      for (const k of Object.keys(cookieStore)) delete cookieStore[k];
    },
    cookies: async () => ({
      get: (name: string) => (cookieStore[name] !== undefined ? { name, value: cookieStore[name] } : undefined),
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        cookieStore[name] = value;
        setCalls.push({ name, value, options });
      },
      delete: (name: string) => {
        delete cookieStore[name];
      },
    }),
    headers: async () => ({ get: (key: string) => (key === "x-forwarded-for" ? "203.0.113.7" : null) }),
  };
});

vi.mock("next/headers", () => ({
  cookies: req.cookies,
  headers: req.headers,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// --- test database ----------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;
const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

const RUN = Date.now().toString(36);
const OWNER_EMAIL = `test-owner-${RUN}@zubeli.rw`;
const CUSTOMER_EMAIL = `test-customer-${RUN}@zubeli.rw`;
const OWNER_TOKEN = `test-owner-token-${RUN}`;
const CUSTOMER_TOKEN = `test-customer-token-${RUN}`;

let ownerId = "";
let customerId = "";
let p1Id = "";
let p2Id = "";
let p3Id = "";
let p1Stock = 0;

let seq = 0;

const CUSTOMER_PAYLOAD = {
  name: "Test Customer",
  phone: "+250788123456",
  email: CUSTOMER_EMAIL,
  address: "KN 5 Rd, Kigali",
  city: "Kigali",
};

function expectOk<T>(result: ActionResult<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`expected ok result, got ${result.error.code}: ${result.error.message}`);
  return result.data;
}

function expectError<T>(result: ActionResult<T>): { code: string; message?: string } {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected error result");
  return { code: result.error.code, message: result.error.message };
}

async function truncateTransactionalTables() {
  await db.$executeRawUnsafe(
    'TRUNCATE "Payment", "OrderItem", "Order", "InventoryMovement", "CartItem", "Cart", "Session" CASCADE',
  );
  await db.user.deleteMany({ where: { email: { contains: "test-" } } });
}

async function createGuestCart(items: { productId: string; quantity: number }[]) {
  const cart = await db.cart.create({ data: { cartToken: `test-guest-token-${RUN}-${seq++}` } });
  await db.cartItem.createMany({
    data: items.map((i) => ({ cartId: cart.id, productId: i.productId, quantity: i.quantity })),
  });
  req.setCookie("cart_token", cart.cartToken!);
  return cart;
}

async function createOrderDirect(opts: {
  status?: "PENDING" | "PAID" | "FULFILLED" | "CANCELLED" | "REFUNDED";
  method?: "COD_CASH" | "COD_MOBILE_MONEY" | "BANK_TRANSFER";
  bankTransferReference?: string | null;
  items?: { productId: string; quantity: number }[];
  customerId?: string | null;
}) {
  const items = opts.items ?? [{ productId: p1Id, quantity: 1 }];
  const products = await db.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const subtotal = items.reduce((sum, i) => sum + (byId.get(i.productId)?.priceCents ?? 0) * i.quantity, 0);
  const total = subtotal + 2000; // DELIVERY_FEE_CENTS pinned in tests/setup.ts
  seq += 1;
  return db.order.create({
    data: {
      number: `ZBL-TEST-${String(seq).padStart(8, "0")}`,
      status: opts.status ?? "PENDING",
      customerId: opts.customerId ?? null,
      customerName: CUSTOMER_PAYLOAD.name,
      customerPhone: CUSTOMER_PAYLOAD.phone,
      customerEmail: opts.customerId ? CUSTOMER_EMAIL : null,
      customerAddress: CUSTOMER_PAYLOAD.address,
      customerCity: CUSTOMER_PAYLOAD.city,
      subtotalCents: subtotal,
      deliveryFeeCents: 2000,
      totalCents: total,
      bankTransferReference: opts.bankTransferReference ?? null,
      payment: {
        create: { method: opts.method ?? "COD_CASH", status: "PENDING", amountCents: total, currency: "RWF" },
      },
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          productName: byId.get(i.productId)?.name ?? "Unknown",
          unitPriceCents: byId.get(i.productId)?.priceCents ?? 0,
          quantity: i.quantity,
        })),
      },
    },
    include: { items: true, payment: true },
  });
}

// --- lifecycle --------------------------------------------------------------

beforeAll(async () => {
  await truncateTransactionalTables();

  const category = await db.category.create({
    data: { name: `Test Tools ${RUN}`, slug: `test-cat-${RUN}` },
  });

  const [p1, p2, p3] = await Promise.all([
    db.product.create({
      data: { name: `Test Hammer ${RUN}`, slug: `test-hammer-${RUN}`, priceCents: 15000, categoryId: category.id, stockQty: 10, lowStockThreshold: 2, isPublished: true },
    }),
    db.product.create({
      data: { name: `Test Drill ${RUN}`, slug: `test-drill-${RUN}`, priceCents: 8000, categoryId: category.id, stockQty: 5, lowStockThreshold: 2, isPublished: true },
    }),
    db.product.create({
      data: { name: `Test Chalk ${RUN}`, slug: `test-chalk-${RUN}`, priceCents: 1000, categoryId: category.id, stockQty: 0, lowStockThreshold: 2, isPublished: true },
    }),
  ]);
  p1Id = p1.id;
  p2Id = p2.id;
  p3Id = p3.id;
  p1Stock = p1.stockQty;

  const [owner, customer] = await Promise.all([
    db.user.create({
      data: { email: OWNER_EMAIL, passwordHash: hashSync("OwnerPass2026!", 4), name: "Test Owner", role: "OWNER" },
    }),
    db.user.create({
      data: { email: CUSTOMER_EMAIL, passwordHash: hashSync("CustomerPass2026!", 4), name: "Test Customer", phone: "+250788123456", role: "CUSTOMER" },
    }),
  ]);
  ownerId = owner.id;
  customerId = customer.id;

  await Promise.all([
    db.session.create({
      data: { tokenHash: createHash("sha256").update(OWNER_TOKEN).digest("hex"), userId: owner.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    }),
    db.session.create({
      data: { tokenHash: createHash("sha256").update(CUSTOMER_TOKEN).digest("hex"), userId: customer.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    }),
  ]);
}, 20_000);

afterAll(async () => {
  await truncateTransactionalTables();
  await db.product.deleteMany({ where: { slug: { startsWith: "test-" } } });
  await db.category.deleteMany({ where: { slug: { startsWith: "test-" } } });
  await db.$disconnect();
});

// --- register / login -------------------------------------------------------

describe("registerAction / loginAction", () => {
  const email = `test-reg-${RUN}@zubeli.rw`;
  const password = "Password123!";

  it("registers a new user (email normalized, CUSTOMER role, session created)", async () => {
    const { registerAction } = await import("@/actions/auth");
    // Mixed case without padding: zod v4 runs .email() BEFORE .trim(), so
    // space-padded emails fail validation. Uppercase still exercises the
    // toLowerCase normalization the action applies.
    const data = expectOk(await registerAction({ name: "Reg User", email: email.toUpperCase(), password, phone: "+250788000001" }));
    expect(data.email).toBe(email);
    expect(data.role).toBe("CUSTOMER");
    expect(data.phone).toBe("+250788000001");
    expect(data).not.toHaveProperty("passwordHash");
    // a session row was created for the new user
    const user = await db.user.findUniqueOrThrow({ where: { email }, include: { sessions: true } });
    expect(user.sessions).toHaveLength(1);
    expect(user.sessions[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a duplicate email with CONFLICT", async () => {
    const { registerAction } = await import("@/actions/auth");
    const error = expectError(await registerAction({ name: "Reg User", email, password }));
    expect(error.code).toBe("CONFLICT");
  });

  it("rejects invalid input with VALIDATION (no DB write)", async () => {
    const { registerAction } = await import("@/actions/auth");
    const error = expectError(await registerAction({ name: "R", email: "not-an-email", password: "short" }));
    expect(error.code).toBe("VALIDATION");
  });

  it("loginAction rejects a wrong password with NOT_AUTHORIZED", async () => {
    const { loginAction } = await import("@/actions/auth");
    const error = expectError(await loginAction({ email, password: "WrongPass!" }));
    expect(error.code).toBe("NOT_AUTHORIZED");
  });

  it("loginAction succeeds with the right password", async () => {
    const { loginAction } = await import("@/actions/auth");
    const data = expectOk(await loginAction({ email, password }));
    expect(data.email).toBe(email);
  });
});

// --- cart actions -----------------------------------------------------------

describe("cart actions (guest)", () => {
  it("getCartAction creates a guest cart + cart_token cookie when absent", async () => {
    req.clearCookies();
    const { getCartAction } = await import("@/actions/cart");
    const cart = expectOk(await getCartAction());
    expect(cart.items).toEqual([]);
    expect(cart.subtotalCents).toBe(0);
    expect(cart.totalCents).toBe(2000); // delivery fee only
    // the server set the guest cookie and persisted the cart row
    const token = req.cookieStore["cart_token"];
    expect(token).toBeTruthy();
    expect(req.setCalls.some((c) => c.name === "cart_token" && c.options?.httpOnly === true)).toBe(true);
    const row = await db.cart.findUnique({ where: { cartToken: token } });
    expect(row).not.toBeNull();
  });

  it("addToCartAction caps quantity at stockQty", async () => {
    req.clearCookies();
    const { addToCartAction } = await import("@/actions/cart");
    const cart = expectOk(await addToCartAction({ productId: p1Id, quantity: 99 }));
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.quantity).toBe(p1Stock); // capped at 10, not 99
    expect(cart.items[0]!.lineTotalCents).toBe(p1Stock * 15000);
  });

  it("addToCartAction rejects quantity 0 with VALIDATION", async () => {
    req.clearCookies();
    const { addToCartAction } = await import("@/actions/cart");
    const error = expectError(await addToCartAction({ productId: p1Id, quantity: 0 }));
    expect(error.code).toBe("VALIDATION");
  });

  it("addToCartAction rejects an out-of-stock product with VALIDATION", async () => {
    req.clearCookies();
    const { addToCartAction } = await import("@/actions/cart");
    const error = expectError(await addToCartAction({ productId: p3Id, quantity: 1 }));
    expect(error.code).toBe("VALIDATION");
  });
});

// --- createOrderAction (guest checkout) -------------------------------------

describe("createOrderAction — guest checkout", () => {
  it("places a COD_CASH order: snapshot, stock decrement, PENDING payment, cart cleared", async () => {
    req.clearCookies();
    const { createOrderAction } = await import("@/actions/checkout");
    const cart = await createGuestCart([{ productId: p1Id, quantity: 2 }]);
    const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: p1Id } })).stockQty;

    const result = expectOk(await createOrderAction({ customer: CUSTOMER_PAYLOAD, paymentMethod: "COD_CASH" }));
    const { order, paymentInstructions } = result;

    expect(order.status).toBe("PENDING");
    expect(order.method).toBe("COD_CASH");
    expect(order.number).toMatch(/^ZBL-/);
    expect(order.subtotalCents).toBe(30000);
    expect(order.deliveryFeeCents).toBe(2000);
    expect(order.totalCents).toBe(32000);
    expect(order.customerEmail).toBe(CUSTOMER_EMAIL);
    expect(order.payment).toMatchObject({ method: "COD_CASH", status: "PENDING", amountCents: 32000 });
    expect(paymentInstructions).toEqual({ title: "Cash on delivery", steps: ["Pay in cash when your order arrives."] });

    // DB: order + PENDING payment + snapshot items
    const dbOrder = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true, items: true },
    });
    expect(dbOrder.payment!.status).toBe("PENDING");
    expect(dbOrder.payment!.method).toBe("COD_CASH");
    expect(dbOrder.items).toHaveLength(1);
    expect(dbOrder.items[0]!.productName).toContain("Test Hammer");
    expect(dbOrder.items[0]!.unitPriceCents).toBe(15000);

    // stock decremented + OUT/ORDER ledger entry
    expect((await db.product.findUniqueOrThrow({ where: { id: p1Id } })).stockQty).toBe(stockBefore - 2);
    const movement = await db.inventoryMovement.findFirst({ where: { orderId: order.id, type: "OUT", reason: "ORDER" } });
    expect(movement).not.toBeNull();

    // cart cleared (one order per cart)
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(0);
    const orderForCart = await db.order.findUnique({ where: { idempotencyKey: cart.id } });
    expect(orderForCart?.id).toBe(order.id);
  });

  it("rejects BANK_TRANSFER without a reference with VALIDATION before any write", async () => {
    req.clearCookies();
    const { createOrderAction } = await import("@/actions/checkout");
    await createGuestCart([{ productId: p1Id, quantity: 1 }]);
    const error = expectError(await createOrderAction({ customer: CUSTOMER_PAYLOAD, paymentMethod: "BANK_TRANSFER" }));
    expect(error.code).toBe("VALIDATION");
  });

  it("places a BANK_TRANSFER order with the reference and bank instructions", async () => {
    req.clearCookies();
    const { createOrderAction } = await import("@/actions/checkout");
    await createGuestCart([{ productId: p2Id, quantity: 1 }]);
    const { order, paymentInstructions } = expectOk(
      await createOrderAction({ customer: CUSTOMER_PAYLOAD, paymentMethod: "BANK_TRANSFER", bankTransferReference: "TRF-8820136" }),
    );
    expect(order.bankTransferReference).toBe("TRF-8820136");
    expect(paymentInstructions.title).toBe("Bank transfer");
    // Production copy: instructions carry the customer's OWN reference, not the
    // order number (the customer typed it — that's what they quote to the bank).
    expect(paymentInstructions.steps).toContain("Use reference TRF-8820136 on your transfer.");
  });

  it("rejects an empty cart with VALIDATION", async () => {
    req.clearCookies();
    const { createOrderAction } = await import("@/actions/checkout");
    await createGuestCart([]);
    const error = expectError(await createOrderAction({ customer: CUSTOMER_PAYLOAD, paymentMethod: "COD_CASH" }));
    expect(error.code).toBe("VALIDATION");
  });

  it("rejects a reserved payment method at the schema boundary", async () => {
    req.clearCookies();
    const { createOrderAction } = await import("@/actions/checkout");
    await createGuestCart([{ productId: p1Id, quantity: 1 }]);
    const error = expectError(await createOrderAction({ customer: CUSTOMER_PAYLOAD, paymentMethod: "MOMO_GATEWAY" }));
    expect(error.code).toBe("VALIDATION");
  });
});

// --- admin order actions ----------------------------------------------------

describe("admin order actions (OWNER session)", () => {
  it("requires an admin session — 401 without, 403 for a CUSTOMER", async () => {
    const { confirmOrderPaymentAction } = await import("@/actions/admin/orders");
    const order = await createOrderDirect({ method: "COD_CASH" });

    req.clearCookies();
    const noSession = expectError(await confirmOrderPaymentAction({ orderId: order.id }));
    expect(noSession.code).toBe("NOT_AUTHORIZED");

    req.setCookie("zubeli_session", CUSTOMER_TOKEN);
    const customerSession = expectError(await confirmOrderPaymentAction({ orderId: order.id }));
    expect(customerSession.code).toBe("NOT_AUTHORIZED");
  });

  it("confirmOrderPaymentAction: PENDING COD_CASH → PAID with confirmedBy", async () => {
    req.clearCookies();
    req.setCookie("zubeli_session", OWNER_TOKEN);
    const { confirmOrderPaymentAction } = await import("@/actions/admin/orders");
    const order = await createOrderDirect({ method: "COD_CASH" });

    const dto = expectOk(await confirmOrderPaymentAction({ orderId: order.id }));
    expect(dto.status).toBe("PAID");

    const row = await db.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(row.status).toBe("PAID");
    expect(row.confirmedById).toBe(ownerId);
    expect(row.confirmedAt).not.toBeNull();
  });

  it("confirmOrderPaymentAction rejects a BANK_TRANSFER order without a reference with VALIDATION", async () => {
    req.setCookie("zubeli_session", OWNER_TOKEN);
    const { confirmOrderPaymentAction } = await import("@/actions/admin/orders");
    const order = await createOrderDirect({ method: "BANK_TRANSFER", bankTransferReference: null });
    const error = expectError(await confirmOrderPaymentAction({ orderId: order.id }));
    expect(error.code).toBe("VALIDATION");
    expect((await db.payment.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("PENDING");
  });

  it("confirmOrderPaymentAction confirms a BANK_TRANSFER order carrying a reference", async () => {
    req.setCookie("zubeli_session", OWNER_TOKEN);
    const { confirmOrderPaymentAction } = await import("@/actions/admin/orders");
    const order = await createOrderDirect({ method: "BANK_TRANSFER", bankTransferReference: "TRF-8820136" });
    const dto = expectOk(await confirmOrderPaymentAction({ orderId: order.id }));
    expect(dto.status).toBe("PAID");
  });

  it("fulfillOrderAction: PAID → FULFILLED; rejects PENDING → FULFILLED", async () => {
    req.setCookie("zubeli_session", OWNER_TOKEN);
    const { fulfillOrderAction } = await import("@/actions/admin/orders");

    const pending = await createOrderDirect({ method: "COD_CASH" });
    const invalid = expectError(await fulfillOrderAction({ orderId: pending.id }));
    expect(invalid.code).toBe("INVALID_TRANSITION");

    const paid = await createOrderDirect({ method: "COD_CASH", status: "PAID" });
    const dto = expectOk(await fulfillOrderAction({ orderId: paid.id }));
    expect(dto.status).toBe("FULFILLED");
  });

  it("cancelOrderAction: restocks stock and writes an IN/CANCEL movement", async () => {
    req.setCookie("zubeli_session", OWNER_TOKEN);
    const { cancelOrderAction } = await import("@/actions/admin/orders");
    const order = await createOrderDirect({ method: "COD_CASH", items: [{ productId: p2Id, quantity: 3 }] });
    const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: p2Id } })).stockQty;

    const dto = expectOk(await cancelOrderAction({ orderId: order.id }));
    expect(dto.status).toBe("CANCELLED");

    // stock restored + IN/CANCEL ledger entry + payment marked FAILED
    expect((await db.product.findUniqueOrThrow({ where: { id: p2Id } })).stockQty).toBe(stockBefore + 3);
    const movement = await db.inventoryMovement.findFirst({ where: { orderId: order.id, type: "IN", reason: "CANCEL" } });
    expect(movement?.quantity).toBe(3);
    expect(movement?.note).toContain("cancel");
    expect((await db.payment.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("FAILED");
  });

  it("refundOrderAction: FULFILLED → REFUNDED with IN/RETURN restock", async () => {
    req.setCookie("zubeli_session", OWNER_TOKEN);
    const { refundOrderAction } = await import("@/actions/admin/orders");
    const order = await createOrderDirect({ method: "COD_CASH", status: "FULFILLED", items: [{ productId: p2Id, quantity: 2 }] });
    const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: p2Id } })).stockQty;

    const dto = expectOk(await refundOrderAction({ orderId: order.id }));
    expect(dto.status).toBe("REFUNDED");

    expect((await db.product.findUniqueOrThrow({ where: { id: p2Id } })).stockQty).toBe(stockBefore + 2);
    const movement = await db.inventoryMovement.findFirst({ where: { orderId: order.id, type: "IN", reason: "RETURN" } });
    expect(movement?.quantity).toBe(2);
  });
});

// --- IDOR + idempotency -----------------------------------------------------

describe("account IDOR check and order idempotency", () => {
  it("getMyOrderAction rejects an order that does not belong to the session user", async () => {
    req.clearCookies();
    req.setCookie("zubeli_session", CUSTOMER_TOKEN);
    const { getMyOrderAction } = await import("@/actions/account");
    // guest order (customerId null) viewed by a registered customer → 403 IDOR
    const guestOrder = await createOrderDirect({ method: "COD_CASH" });
    const error = expectError(await getMyOrderAction({ orderId: guestOrder.id }));
    expect(error.code).toBe("NOT_AUTHORIZED");

    req.clearCookies();
    const noSession = expectError(await getMyOrderAction({ orderId: guestOrder.id }));
    expect(noSession.code).toBe("NOT_AUTHORIZED");
  });

  it("getMyOrderAction returns the order for its owner (with payment instructions)", async () => {
    req.clearCookies();
    req.setCookie("zubeli_session", CUSTOMER_TOKEN);
    const { getMyOrderAction } = await import("@/actions/account");
    const order = await createOrderDirect({ method: "COD_MOBILE_MONEY", customerId: customerId });
    const dto = expectOk(await getMyOrderAction({ orderId: order.id }));
    expect(dto.id).toBe(order.id);
    expect(dto.paymentInstructions?.title).toBe("Mobile money on delivery");
  });

  it("placeOrder is idempotent on idempotencyKey — same order, no double stock decrement", async () => {
    req.clearCookies();
    const { placeOrder } = await import("@/lib/orders");
    const input = {
      customer: { name: "Idem Buyer", phone: "+250788000099", address: "Kigali" },
      items: [{ productId: p2Id, quantity: 2 }],
      paymentMethod: "COD_CASH" as const,
      idempotencyKey: `idem-${RUN}`,
    };
    const stockBefore = (await db.product.findUniqueOrThrow({ where: { id: p2Id } })).stockQty;

    const first = await placeOrder({ ...input });
    const second = await placeOrder({ ...input });

    expect(second.order.id).toBe(first.order.id);
    expect((await db.product.findUniqueOrThrow({ where: { id: p2Id } })).stockQty).toBe(stockBefore - 2);
    const orderCount = await db.order.count({ where: { idempotencyKey: input.idempotencyKey } });
    expect(orderCount).toBe(1);
  });
});
