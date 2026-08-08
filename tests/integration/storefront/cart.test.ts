/**
 * Storefront buying flow — cart actions (Phase C, Checkpoint 3).
 *
 * The actions (src/actions/cart.ts) run against the REAL lib/cart business
 * logic (stock capping, cart resolution, DTO mapping) with the DB layer
 * mocked at the prisma singleton (src/lib/db) — no live DB, no dev server.
 * The mocked client mirrors what the repository layer would do: upsert the
 * cart row keyed by cookie token, store cart lines, return the cart with
 * product rows. next/headers is mocked so the guest cart_token cookie flows
 * through an in-memory cookie store; next/cache revalidation is a no-op.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, Product } from "@prisma/client";

// --- mocks ----------------------------------------------------------------

const m = vi.hoisted(() => {
  const cookieStore: Record<string, string> = {};
  const setCalls: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  // Single active cart per test (cookie is cleared in beforeEach): the
  // cart_token cookie changes per test → getOrCreateCart starts a fresh row.
  const products = new Map<string, Product & { category: Category }>();
  let cart: { id: string; token: string; items: { cartItemId: string; productId: string; quantity: number }[] } | null = null;
  let cartSeq = 0;

  const client = {
    session: {
      findUnique: vi.fn(async () => null), // guest — no session cookie
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
      upsert: vi.fn(async ({ create, update }: { create: { cartId: string; productId: string; quantity: number }; update: { quantity: number } }) => {
        const existing = cart!.items.find((i) => i.productId === create.productId);
        if (existing) existing.quantity = update.quantity;
        else cart!.items.push({ cartItemId: `ci-${cart!.items.length + 1}`, productId: create.productId, quantity: create.quantity });
        return { id: "ci-x" };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { quantity: number } }) => {
        const item = cart!.items.find((i) => i.cartItemId === where.id);
        if (item) item.quantity = data.quantity;
        return {};
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        cart!.items = cart!.items.filter((i) => i.cartItemId !== where.id);
        return {};
      }),
    },
    product: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => products.get(where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        [...products.values()].filter((p) => where.id.in.includes(p.id)),
      ),
    },
    $transaction: vi.fn(async () => {
      throw new Error("interactive $transaction not expected in cart action tests");
    }),
  };

  return {
    cookieStore,
    setCalls,
    client,
    reset: () => {
      cart = null;
      cartSeq = 0;
      products.clear();
    },
    setProduct: (p: Product & { category: Category }) => {
      products.set(p.id, p);
    },
    clearCookies: () => {
      for (const k of Object.keys(cookieStore)) delete cookieStore[k];
      setCalls.length = 0;
    },
  };
});

vi.mock("@/lib/db", () => ({ prisma: m.client }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (m.cookieStore[name] !== undefined ? { name, value: m.cookieStore[name] } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      m.cookieStore[name] = value;
      m.setCalls.push({ name, value, options });
    },
    delete: (name: string) => {
      delete m.cookieStore[name];
    },
  }),
  headers: async () => ({ get: () => null }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { addToCartAction, getCartAction, removeCartItemAction, updateCartQtyAction } from "@/actions/cart";

// --- fixtures + helpers ---------------------------------------------------

const CATEGORY: Category = {
  id: "cat-1",
  slug: "hand-tools",
  name: "Hand Tools",
  description: "Hammers, wrenches, chisels",
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

function expectOk<T>(result: { ok: boolean; data?: T; error?: { code: string; message: string; details?: unknown } }): T {
  if (!result.ok || result.data === undefined) {
    throw new Error(`expected ok result, got ${(result as { error: { code: string } }).error.code}`);
  }
  return result.data;
}

function expectError<T>(result: { ok: boolean; data?: T; error?: { code: string; message: string; details?: unknown } }): {
  code: string;
  details?: unknown;
} {
  if (result.ok || !result.error) throw new Error("expected error result");
  return { code: result.error.code, details: result.error.details };
}

beforeEach(() => {
  m.reset();
  m.clearCookies();
  vi.clearAllMocks();
});

// --- tests ----------------------------------------------------------------

describe("getCartAction (guest)", () => {
  it("creates a guest cart + httpOnly cart_token cookie and returns an empty CartDTO", async () => {
    const cart = expectOk(await getCartAction());
    expect(cart.items).toEqual([]);
    expect(cart.subtotalCents).toBe(0);
    expect(cart.deliveryFeeCents).toBe(2000); // DELIVERY_FEE_CENTS pinned in tests/setup.ts
    expect(cart.totalCents).toBe(2000);
    expect(cart.currency).toBe("RWF");

    const token = m.cookieStore["cart_token"];
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(m.setCalls.some((c) => c.name === "cart_token" && c.options?.httpOnly === true)).toBe(true);
  });
});

describe("addToCartAction", () => {
  it("adds an item and returns the CartDTO with derived totals", async () => {
    m.setProduct(productFixture());
    const cart = expectOk(await addToCartAction({ productId: "p-1", quantity: 2 }));

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.product).toMatchObject({ id: "p-1", name: "Claw Hammer", priceCents: 15000, category: { slug: "hand-tools" } });
    expect(cart.items[0]!.quantity).toBe(2);
    expect(cart.items[0]!.lineTotalCents).toBe(30000);
    expect(cart.subtotalCents).toBe(30000);
    expect(cart.totalCents).toBe(32000);
  });

  it("caps the quantity at stockQty (99 requested, 10 in stock)", async () => {
    m.setProduct(productFixture({ stockQty: 10 }));
    const cart = expectOk(await addToCartAction({ productId: "p-1", quantity: 99 }));

    expect(cart.items[0]!.quantity).toBe(10);
    expect(cart.items[0]!.lineTotalCents).toBe(150000);
    expect(m.client.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ quantity: 10 }) }),
    );
  });

  it("returns NOT_FOUND for a missing product", async () => {
    const error = expectError(await addToCartAction({ productId: "p-missing", quantity: 1 }));
    expect(error.code).toBe("NOT_FOUND");
    expect(m.client.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("returns VALIDATION for an out-of-stock product (no upsert)", async () => {
    m.setProduct(productFixture({ stockQty: 0 }));
    const error = expectError(await addToCartAction({ productId: "p-1", quantity: 1 }));
    expect(error.code).toBe("VALIDATION");
    expect(m.client.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("returns VALIDATION with fieldErrors for invalid input", async () => {
    const error = expectError(await addToCartAction({ productId: "", quantity: 1 }));
    expect(error.code).toBe("VALIDATION");
    expect(error.details).toMatchObject({ fieldErrors: expect.objectContaining({ productId: expect.any(Array) }) });
  });

  it("returns VALIDATION for quantity 0 or above the 99 ceiling", async () => {
    m.setProduct(productFixture());
    expect(expectError(await addToCartAction({ productId: "p-1", quantity: 0 })).code).toBe("VALIDATION");
    expect(expectError(await addToCartAction({ productId: "p-1", quantity: 100 })).code).toBe("VALIDATION");
  });
});

describe("updateCartQtyAction", () => {
  it("sets an absolute quantity (capped at stock) and returns the DTO", async () => {
    m.setProduct(productFixture({ stockQty: 10 }));
    await addToCartAction({ productId: "p-1", quantity: 5 });

    const cart = expectOk(await updateCartQtyAction({ productId: "p-1", quantity: 3 }));
    expect(cart.items[0]!.quantity).toBe(3);
    expect(m.client.cartItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: 3 } }));

    const capped = expectOk(await updateCartQtyAction({ productId: "p-1", quantity: 99 }));
    expect(capped.items[0]!.quantity).toBe(10);
  });

  it("rejects quantity 0 at the schema boundary (remove-line path is lib-level)", async () => {
    m.setProduct(productFixture());
    const error = expectError(await updateCartQtyAction({ productId: "p-1", quantity: 0 }));
    expect(error.code).toBe("VALIDATION");
  });

  it("returns NOT_FOUND for an item that is not in the cart", async () => {
    m.setProduct(productFixture());
    const error = expectError(await updateCartQtyAction({ productId: "p-1", quantity: 2 }));
    expect(error.code).toBe("NOT_FOUND");
    expect(m.client.cartItem.update).not.toHaveBeenCalled();
  });
});

describe("removeCartItemAction", () => {
  it("removes the line and returns the empty DTO", async () => {
    m.setProduct(productFixture());
    await addToCartAction({ productId: "p-1", quantity: 2 });

    const cart = expectOk(await removeCartItemAction({ productId: "p-1" }));
    expect(cart.items).toEqual([]);
    expect(cart.subtotalCents).toBe(0);
    expect(cart.totalCents).toBe(2000);
    expect(m.client.cartItem.delete).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND for an item that is not in the cart", async () => {
    m.setProduct(productFixture());
    const error = expectError(await removeCartItemAction({ productId: "p-1" }));
    expect(error.code).toBe("NOT_FOUND");
    expect(m.client.cartItem.delete).not.toHaveBeenCalled();
  });
});
