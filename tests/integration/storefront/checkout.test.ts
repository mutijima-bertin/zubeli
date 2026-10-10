/**
 * Storefront buying flow — checkout actions (Phase C, Checkpoint 3).
 *
 * createOrderAction / getCheckoutCartAction / getCheckoutOrderAction run
 * against the REAL lib/orders orchestration (buildCheckoutContext, placeOrder,
 * payment providers) with the DB layer mocked at the prisma singleton.
 * The mocked $transaction plays the role of the createOrder repository
 * transaction: it reads product stock, creates the Order + snapshot items +
 * PENDING Payment, decrements stock and clears the cart — exactly what
 * src/lib/db/orders.ts would do, so the real checkout math (subtotal/total,
 * stock validation, OUT_OF_STOCK mapping) is exercised.
 * next/headers is mocked (guest cart cookie + rate-limit IP); next/cache is a
 * no-op. No live DB, no dev server.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
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
      // createOrder idempotency pre-check (where.idempotencyKey) + getOrderById (where.id)
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
    /** Seeds the active cart (call after the cart row exists via a cart action). */
    seedCart: (items: { productId: string; quantity: number }[]) => {
      if (!cart) throw new Error("seedCart: no cart yet — call a cart action first");
      cart.items = items.map((i, idx) => ({ cartItemId: `ci-${idx + 1}`, productId: i.productId, quantity: i.quantity }));
    },
    /** Seeds an existing order row (getCheckoutOrderAction lookups). */
    seedOrder: (order: Record<string, unknown>) => {
      orders.push(order);
    },
    /** Spy handles into the fake tx (assert transaction effects). */
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

import { createOrderAction, getCheckoutCartAction, getCheckoutOrderAction } from "@/actions/checkout";
import { getCartAction } from "@/actions/cart";

const revalidatePathM = vi.mocked(revalidatePath);

// --- fixtures + helpers ---------------------------------------------------

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

/** Guest flow: set cookie → materialize cart → seed items. */
async function cartWithItems(items: { productId: string; quantity: number }[]) {
  m.cookieStore["cart_token"] = `guest-${Math.random().toString(36).slice(2)}`;
  await getCartAction(); // ensureCart() materializes the cart row from the cookie
  m.seedCart(items);
}

beforeEach(() => {
  m.reset();
  m.clearCookies();
  vi.clearAllMocks();
});

// --- tests ----------------------------------------------------------------

describe("getCheckoutCartAction", () => {
  it("returns the empty guest cart", async () => {
    const cart = expectOk(await getCheckoutCartAction());
    expect(cart.items).toEqual([]);
    expect(cart.totalCents).toBe(0); // no delivery fee — empty cart is 0
    expect(m.cookieStore["cart_token"]).toBeTruthy(); // guest cookie created
  });
});

describe("createOrderAction", () => {
  it("places a COD_CASH order: PENDING, snapshots, derived totals, instructions, cart cleared", async () => {
    m.setProduct(productFixture({ stockQty: 10 }));
    await cartWithItems([{ productId: "p-1", quantity: 2 }]);

    const result = expectOk(await createOrderAction({ customer: CUSTOMER, paymentMethod: "COD_CASH" }));
    const { order, paymentInstructions } = result;

    expect(order.status).toBe("PENDING");
    expect(order.method).toBe("COD_CASH");
    expect(order.number).toMatch(/^ZBL-/);
    expect(order.subtotalCents).toBe(30000);
    expect(order.totalCents).toBe(30000); // no delivery fee — total == subtotal
    expect(order.customerName).toBe("Umutoni");
    expect(order.items).toEqual([
      expect.objectContaining({ productName: "Claw Hammer", unitPriceCents: 15000, quantity: 2, lineTotalCents: 30000 }),
    ]);
    expect(order.payment).toMatchObject({ method: "COD_CASH", status: "PENDING", amountCents: 30000 });
    expect(paymentInstructions).toEqual({ title: "Cash on delivery", steps: ["Pay in cash when your order arrives."] });

    // Real transaction effects: stock decremented, cart cleared, revalidation
    expect(m.stockOf("p-1")).toBe(8);
    expect(m.tx.cartItemDeleteMany).toHaveBeenCalledWith({ where: { cartId: expect.any(String) } });
    expect(revalidatePathM).toHaveBeenCalledWith("/account/orders");
  });

  it("rejects BANK_TRANSFER without a reference with VALIDATION before any write", async () => {
    m.setProduct(productFixture());
    await cartWithItems([{ productId: "p-1", quantity: 1 }]);

    const error = expectError(await createOrderAction({ customer: CUSTOMER, paymentMethod: "BANK_TRANSFER" }));
    expect(error.code).toBe("VALIDATION");
    expect(error.details).toMatchObject({ fieldErrors: expect.objectContaining({ bankTransferReference: expect.any(Array) }) });
    expect(m.client.$transaction).not.toHaveBeenCalled(); // schema boundary — no DB write
  });

  it("places a BANK_TRANSFER order — instructions carry the customer's reference", async () => {
    m.setProduct(productFixture());
    await cartWithItems([{ productId: "p-1", quantity: 1 }]);

    const { order, paymentInstructions } = expectOk(
      await createOrderAction({ customer: CUSTOMER, paymentMethod: "BANK_TRANSFER", bankTransferReference: "TRF-8820136" }),
    );
    expect(order.bankTransferReference).toBe("TRF-8820136");
    expect(paymentInstructions.title).toBe("Bank transfer");
    // Production copy (src/lib/payments/providers.ts): the customer's OWN
    // reference is what they quote to the bank.
    expect(paymentInstructions.steps).toContain("Use reference TRF-8820136 on your transfer.");
    expect(m.stockOf("p-1")).toBe(9);
  });

  it("places a COD_MOBILE_MONEY order with the shop MoMo number in the instructions", async () => {
    m.setProduct(productFixture());
    await cartWithItems([{ productId: "p-1", quantity: 1 }]);

    const { paymentInstructions } = expectOk(await createOrderAction({ customer: CUSTOMER, paymentMethod: "COD_MOBILE_MONEY" }));
    expect(paymentInstructions.title).toBe("Mobile money on delivery");
    expect(paymentInstructions.steps).toContain("Pay at the door via MTN MoMo or Airtel Money to +250700000000.");
  });

  it("returns OUT_OF_STOCK when a cart quantity exceeds current stock", async () => {
    m.setProduct(productFixture({ stockQty: 3 }));
    await cartWithItems([{ productId: "p-1", quantity: 5 }]);

    const error = expectError(await createOrderAction({ customer: CUSTOMER, paymentMethod: "COD_CASH" }));
    expect(error.code).toBe("OUT_OF_STOCK");
    expect(error.details).toMatchObject({ productName: "Claw Hammer", available: 3, requested: 5 });
    expect(m.txOrderCount()).toBe(0); // transaction rolled back — no order row
  });

  it("rejects an empty cart with VALIDATION", async () => {
    m.setProduct(productFixture());
    await cartWithItems([]);
    const error = expectError(await createOrderAction({ customer: CUSTOMER, paymentMethod: "COD_CASH" }));
    expect(error.code).toBe("VALIDATION");
  });

  it("rejects a cart containing an unpublished product with VALIDATION", async () => {
    m.setProduct(productFixture({ isPublished: false }));
    await cartWithItems([{ productId: "p-1", quantity: 1 }]);
    const error = expectError(await createOrderAction({ customer: CUSTOMER, paymentMethod: "COD_CASH" }));
    expect(error.code).toBe("VALIDATION");
  });

  it("rejects a reserved payment method (MOMO_GATEWAY) at the schema boundary", async () => {
    m.setProduct(productFixture());
    await cartWithItems([{ productId: "p-1", quantity: 1 }]);
    const error = expectError(await createOrderAction({ customer: CUSTOMER, paymentMethod: "MOMO_GATEWAY" }));
    expect(error.code).toBe("VALIDATION");
    expect(m.client.$transaction).not.toHaveBeenCalled();
  });
});

describe("getCheckoutOrderAction (public success-page lookup)", () => {
  function orderFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: "order-1",
      number: "ZBL-00000001",
      status: "PENDING",
      customerId: null,
      customerName: "Umutoni",
      customerPhone: "+250788123456",
      customerEmail: "umutoni@demo.rw",
      customerAddress: "KN 5 Rd, Kigali",
      customerCity: "Kigali",
      subtotalCents: 30000,
      totalCents: 30000,
      currency: "RWF",
      bankTransferReference: null,
      idempotencyKey: "cart-1",
      paidAt: null,
      fulfilledAt: null,
      cancelledAt: null,
      createdAt: new Date("2026-08-07T12:00:00.000Z"),
      updatedAt: new Date("2026-08-07T12:00:00.000Z"),
      items: [
        {
          id: "oi-1",
          orderId: "order-1",
          productId: "p-1",
          productName: "Claw Hammer",
          unitPriceCents: 15000,
          quantity: 2,
          createdAt: new Date("2026-08-07T12:00:00.000Z"),
          updatedAt: new Date("2026-08-07T12:00:00.000Z"),
        },
      ],
      payment: {
        id: "pay-1",
        orderId: "order-1",
        method: "BANK_TRANSFER",
        status: "PENDING",
        amountCents: 30000,
        currency: "RWF",
        confirmedById: null,
        confirmedAt: null,
        createdAt: new Date("2026-08-07T12:00:00.000Z"),
        updatedAt: new Date("2026-08-07T12:00:00.000Z"),
      },
      ...overrides,
    };
  }

  it("returns order + paymentInstructions for a valid order id", async () => {
    m.seedOrder(orderFixture());
    const { order, paymentInstructions } = expectOk(await getCheckoutOrderAction({ orderId: "order-1" }));

    expect(order.id).toBe("order-1");
    expect(order.number).toBe("ZBL-00000001");
    expect(order.status).toBe("PENDING");
    expect(order.totalCents).toBe(30000);
    expect(order.items[0]!.lineTotalCents).toBe(30000);
    // buildPaymentInstructions: the ORDER NUMBER is the transfer reference.
    expect(paymentInstructions).toEqual({
      title: "Bank transfer",
      steps: expect.arrayContaining(["Use the order number ZBL-00000001 as your transfer reference."]),
    });
  });

  it("returns NOT_FOUND for an unknown order id", async () => {
    const error = expectError(await getCheckoutOrderAction({ orderId: "order-unknown" }));
    expect(error.code).toBe("NOT_FOUND");
  });

  it("rejects an empty order id with VALIDATION", async () => {
    const error = expectError(await getCheckoutOrderAction({ orderId: "" }));
    expect(error.code).toBe("VALIDATION");
  });
});
