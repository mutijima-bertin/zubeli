/**
 * Payment-method allowlist enforcement (security regression, 2026-10-05).
 *
 * HIGH: placeOrder persisted an order BEFORE consulting the provider allowlist,
 * so a tampered BANK_TRANSFER request created a real order (stock decrement,
 * OUT/ORDER ledger, cleared cart) even with PAYMENT_METHODS=COD_CASH — the
 * provider rejected it only afterwards, and because idempotencyKey = cart.id a
 * later legitimate retry returned the persisted, unwanted order.
 *
 * MEDIUM: getPaymentProvider returned the demo mock BEFORE the allowlist, so
 * DEMO_MODE=true accepted any method regardless of PAYMENT_METHODS.
 *
 * The DB layer is mocked at the prisma singleton with a fake $transaction that
 * mirrors src/lib/db/orders.ts exactly (same harness as storefront/checkout.test.ts),
 * so the assertions directly observe order-count / stock / ledger / cart effects.
 * Config is re-read per test via `vi.resetModules()` + a dynamic import because
 * `siteConfig` (src/lib/site.ts) is evaluated once at module load.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Product } from "@prisma/client";
import { expectError, expectOk } from "../../helpers/assert";

// --- mocks ----------------------------------------------------------------

const m = vi.hoisted(() => {
  const cookieStore: Record<string, string> = {};

  const products = new Map<string, Product & { category: Category }>();
  const orders: unknown[] = [];
  let cart: { id: string; token: string; items: { cartItemId: string; productId: string; quantity: number }[] } | null = null;
  let cartSeq = 0;
  let orderSeq = 0;

  const fakeTx = {
    product: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] }; deletedAt: Date | null } }) =>
        [...products.values()]
          .filter((p) => where.id.in.includes(p.id) && p.deletedAt === null)
          .map((p) => ({ id: p.id, name: p.name, priceCents: p.priceCents, stockQty: p.stockQty })),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { stockQty: { decrement: number } } }) => {
        const p = products.get(where.id);
        if (p) p.stockQty = p.stockQty - data.stockQty.decrement;
        return p;
      }),
    },
    inventoryMovement: {
      create: vi.fn(async (args: unknown) => args),
    },
    cartItem: {
      deleteMany: vi.fn(async ({ where }: { where: { cartId: string } }) => {
        if (cart && cart.id === where.cartId) cart.items = [];
        return { count: 0 };
      }),
    },
    order: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date("2026-08-07T12:00:00.000Z");
        const id = `order-${++orderSeq}`;
        const itemRows = ((data.items as { create: { productId: string; productName: string; unitPriceCents: number; quantity: number }[] }).create).map(
          (l, i) => ({
            id: `oi-${id}-${i}`,
            orderId: id,
            productId: l.productId,
            productName: l.productName,
            unitPriceCents: l.unitPriceCents,
            quantity: l.quantity,
            createdAt: now,
            updatedAt: now,
          }),
        );
        const payment = {
          id: `pay-${id}`,
          orderId: id,
          method: (data.payment as { create: { method: string; amountCents: number; currency: string } }).create.method,
          status: "PENDING",
          amountCents: (data.payment as { create: { method: string; amountCents: number; currency: string } }).create.amountCents,
          currency: (data.payment as { create: { method: string; amountCents: number; currency: string } }).create.currency,
          confirmedById: null,
          confirmedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        const order = {
          id,
          number: data.number as string,
          status: "PENDING",
          customerId: (data.customerId as string | null) ?? null,
          customerName: data.customerName as string,
          customerPhone: data.customerPhone as string,
          customerEmail: (data.customerEmail as string | null) ?? null,
          customerAddress: data.customerAddress as string,
          customerCity: (data.customerCity as string | null) ?? null,
          subtotalCents: data.subtotalCents as number,
          totalCents: data.totalCents as number,
          currency: data.currency as string,
          bankTransferReference: (data.bankTransferReference as string | null) ?? null,
          idempotencyKey: (data.idempotencyKey as string | null) ?? null,
          paidAt: null,
          fulfilledAt: null,
          cancelledAt: null,
          createdAt: now,
          updatedAt: now,
          items: itemRows,
          payment,
        };
        orders.push(order);
        return order;
      }),
    },
  };

  const client = {
    session: {
      findUnique: vi.fn(async () => null), // guest checkout
      update: vi.fn(async () => ({})),
    },
    cart: {
      upsert: vi.fn(async ({ create }: { create: { cartToken?: string; userId?: string } }) => {
        const token = create.cartToken ?? "";
        if (!cart || cart.token !== token) {
          cart = { id: `cart-${++cartSeq}`, token, items: [] };
        }
        return { id: cart.id, cartToken: create.cartToken ?? null, userId: create.userId ?? null };
      }),
      findUnique: vi.fn(async () => {
        if (!cart) return null;
        return {
          id: cart.id,
          userId: null,
          cartToken: cart.token,
          createdAt: new Date(0),
          updatedAt: new Date(0),
          items: cart.items.map((i) => {
            const product = products.get(i.productId);
            if (!product) throw new Error(`test stub: unknown product ${i.productId}`);
            return {
              id: i.cartItemId,
              cartId: cart!.id,
              productId: i.productId,
              quantity: i.quantity,
              createdAt: new Date(0),
              updatedAt: new Date(0),
              product: {
                id: product.id,
                slug: product.slug,
                name: product.name,
                priceCents: product.priceCents,
                currency: product.currency,
                imageUrls: product.imageUrls,
                stockQty: product.stockQty,
                isPublished: product.isPublished,
              },
            };
          }),
        };
      }),
    },
    cartItem: {
      upsert: vi.fn(async () => ({})),
      update: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    },
    product: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => products.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        [...products.values()].filter((p) => where.id.in.includes(p.id)),
      ),
    },
    order: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; idempotencyKey?: string } }) => {
        if (where.idempotencyKey) return orders.find((o) => (o as { idempotencyKey: string }).idempotencyKey === where.idempotencyKey) ?? null;
        return orders.find((o) => (o as { id: string }).id === where.id) ?? null;
      }),
    },
    $transaction: vi.fn(async (cb: (tx: typeof fakeTx) => Promise<unknown>) => cb(fakeTx)),
  };

  return {
    cookieStore,
    client,
    reset: () => {
      cart = null;
      cartSeq = 0;
      orderSeq = 0;
      orders.length = 0;
      products.clear();
      for (const fn of [
        fakeTx.product.findMany,
        fakeTx.product.update,
        fakeTx.inventoryMovement.create,
        fakeTx.cartItem.deleteMany,
        fakeTx.order.create,
      ]) {
        fn.mockClear();
      }
    },
    setProduct: (p: Product & { category: Category }) => {
      products.set(p.id, p);
    },
    seedCart: (items: { productId: string; quantity: number }[]) => {
      if (!cart) throw new Error("seedCart: no cart yet — call getCartAction first");
      cart.items = items.map((i, idx) => ({ cartItemId: `ci-${idx + 1}`, productId: i.productId, quantity: i.quantity }));
    },
    tx: {
      cartItemDeleteMany: fakeTx.cartItem.deleteMany,
      orderCreate: fakeTx.order.create,
      inventoryMovementCreate: fakeTx.inventoryMovement.create,
    },
    stockOf: (productId: string) => products.get(productId)?.stockQty,
    txOrderCount: () => orders.length,
    clearCookies: () => {
      for (const k of Object.keys(cookieStore)) delete cookieStore[k];
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (m.cookieStore[name] !== undefined ? { name, value: m.cookieStore[name] } : undefined),
    set: (name: string, value: string) => {
      m.cookieStore[name] = value;
    },
    delete: (name: string) => {
      delete m.cookieStore[name];
    },
  }),
  headers: async () => ({ get: (key: string) => (key === "x-forwarded-for" ? "203.0.113.7" : null) }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// --- fixtures -------------------------------------------------------------

const CATEGORY: Category = {
  id: "cat-1",
  slug: "hand-tools",
  name: "Hand Tools",
  description: "Hammers, wrenches, chisels",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function productFixture(overrides: Partial<Product> = {}): Product & { category: Category } {
  return {
    id: "p-1",
    slug: "claw-hammer",
    name: "Claw Hammer",
    description: "16 oz claw hammer with rubber grip",
    imageUrls: ["/images/products/claw-hammer.svg"],
    priceCents: 15000,
    currency: "RWF",
    stockQty: 10,
    lowStockThreshold: 2,
    isPublished: true,
    featured: false,
    categoryId: "cat-1",
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
    category: CATEGORY,
  };
}

const CUSTOMER = { name: "Umutoni", phone: "+250788123456", address: "KN 5 Rd, Kigali", city: "Kigali" };

/**
 * Pin the storefront config (read once at module load) BEFORE importing the
 * action. `vi.resetModules()` drops the cached `siteConfig`; the registered
 * `@/lib/db` mock survives the reset, so the fresh action still uses the fake tx.
 */
async function loadCheckout(opts: { methods?: string; demo?: string }) {
  if (opts.methods === undefined) delete process.env.PAYMENT_METHODS;
  else process.env.PAYMENT_METHODS = opts.methods;
  process.env.DEMO_MODE = opts.demo ?? "false";
  vi.resetModules();
  return import("@/actions/checkout");
}

async function cartWithItems(items: { productId: string; quantity: number }[]) {
  m.cookieStore["cart_token"] = `guest-${Math.random().toString(36).slice(2)}`;
  const { getCartAction } = await import("@/actions/cart");
  await getCartAction(); // materializes the cart row from the cookie
  m.seedCart(items);
}

beforeEach(() => {
  m.reset();
  m.clearCookies();
  vi.clearAllMocks();
});

// --- key regression: allowlist BEFORE persistence -------------------------

describe("createOrderAction — PAYMENT_METHODS=COD_CASH allowlist", () => {
  it("REJECTS BANK_TRANSFER with a field error AND leaves the database untouched", async () => {
    const { createOrderAction } = await loadCheckout({ methods: "COD_CASH" });
    m.setProduct(productFixture({ stockQty: 10 }));
    await cartWithItems([{ productId: "p-1", quantity: 2 }]);

    const error = expectError(
      await createOrderAction({ customer: CUSTOMER, paymentMethod: "BANK_TRANSFER", bankTransferReference: "TRF-8820136" }),
    );

    // The request itself fails with a validation code.
    expect(error.code).toBe("VALIDATION");

    // NO persistence at all: no order/payment row, no stock movement, no ledger
    // entry, cart still intact, and (strongest) the tx never even started.
    // Asserted BEFORE the error shape so a pre-fix failure shows the side
    // effect (order created) rather than only the generic message.
    expect(m.txOrderCount()).toBe(0);
    expect(m.stockOf("p-1")).toBe(10);
    expect(m.tx.orderCreate).not.toHaveBeenCalled();
    expect(m.tx.inventoryMovementCreate).not.toHaveBeenCalled();
    expect(m.tx.cartItemDeleteMany).not.toHaveBeenCalled();
    expect(m.client.$transaction).not.toHaveBeenCalled();

    // A proper field-level validation error (not a generic provider message).
    expect(error.details).toMatchObject({
      fieldErrors: expect.objectContaining({ paymentMethod: expect.any(Array) }),
    });
  });

  it("still allows the offered method (COD_CASH) under PAYMENT_METHODS=COD_CASH", async () => {
    const { createOrderAction } = await loadCheckout({ methods: "COD_CASH" });
    m.setProduct(productFixture({ stockQty: 10 }));
    await cartWithItems([{ productId: "p-1", quantity: 2 }]);

    const { order } = expectOk(await createOrderAction({ customer: CUSTOMER, paymentMethod: "COD_CASH" }));
    expect(order.method).toBe("COD_CASH");
    expect(m.txOrderCount()).toBe(1);
    expect(m.stockOf("p-1")).toBe(8);
  });
});

// --- demo mode must not bypass the allowlist -------------------------------

describe("createOrderAction — DEMO_MODE=true cannot bypass PAYMENT_METHODS", () => {
  it("rejects BANK_TRANSFER and writes nothing with DEMO_MODE=true + PAYMENT_METHODS=COD_CASH", async () => {
    const { createOrderAction } = await loadCheckout({ methods: "COD_CASH", demo: "true" });
    m.setProduct(productFixture({ stockQty: 10 }));
    await cartWithItems([{ productId: "p-1", quantity: 1 }]);

    const error = expectError(
      await createOrderAction({ customer: CUSTOMER, paymentMethod: "BANK_TRANSFER", bankTransferReference: "TRF-8820136" }),
    );
    expect(error.code).toBe("VALIDATION");
    expect(m.txOrderCount()).toBe(0);
    expect(m.stockOf("p-1")).toBe(10);
    expect(m.tx.cartItemDeleteMany).not.toHaveBeenCalled();
    expect(m.client.$transaction).not.toHaveBeenCalled();
  });
});

// --- all MVP methods still work with the allowlist unset -------------------

describe("createOrderAction — default allowlist (env unset)", () => {
  it("places COD_CASH, COD_MOBILE_MONEY and BANK_TRANSFER orders", async () => {
    for (const [method, ref] of [
      ["COD_CASH", undefined],
      ["COD_MOBILE_MONEY", undefined],
      ["BANK_TRANSFER", "TRF-8820136"],
    ] as const) {
      m.reset();
      m.clearCookies();
      const { createOrderAction } = await loadCheckout({ methods: undefined });
      m.setProduct(productFixture({ stockQty: 10 }));
      await cartWithItems([{ productId: "p-1", quantity: 1 }]);

      const { order } = expectOk(
        await createOrderAction({ customer: CUSTOMER, paymentMethod: method, bankTransferReference: ref }),
      );
      expect(order.method).toBe(method);
    }
  });
});
