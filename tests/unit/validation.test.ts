/**
 * Zod validation schemas (src/lib/validation/*) — pure, client-safe,
 * re-validated at the action boundary. Behaviors:
 * - auth: register (min 8 / max 72 password, phone 7-20, email lowercased),
 *   login (min 1 on purpose — uniform bcrypt timing), profile ('' clears phone)
 * - cart: quantity 1..99, coerce numbers
 * - checkout: bankTransferReference conditional on payment method (ADR 0003)
 * - product: priceCents positive, stock non-negative, slug charset, max 8 images
 * - stock: quantity 1..10000, direction defaults IN
 * - orders: status enum, sales period from<=to, topProducts default 5
 */
import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
} from "@/lib/validation/auth";
import { cartItemSchema, removeCartItemSchema } from "@/lib/validation/cart";
import { checkoutSchema } from "@/lib/validation/checkout";
import {
  adminListOrdersSchema,
  adminListCustomersSchema,
  orderStatusSchema,
  pageParamsSchema,
  revenueMonthsSchema,
  salesPeriodSchema,
  topProductsSchema,
} from "@/lib/validation/orders";
import {
  adminListProductsSchema,
  adminUpdateProductSchema,
  productSchema,
} from "@/lib/validation/product";
import { listMovementsSchema, stockAdjustSchema } from "@/lib/validation/stock";

function expectRejected(
  schema: {
    safeParse: (v: unknown) => {
      success: boolean;
      error?: { issues: Array<{ path: readonly unknown[] }> };
    };
  },
  input: unknown,
  atPath?: string,
) {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  if (!result.success && atPath) {
    const paths = (result.error?.issues ?? []).map((issue) => issue.path.join("."));
    expect(paths).toContain(atPath);
  }
}

describe("passwordSchema", () => {
  it("accepts 8-72 char passwords", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
    expect(passwordSchema.safeParse("x".repeat(72)).success).toBe(true);
  });
  it("rejects shorter than 8 and longer than 72", () => {
    expectRejected(passwordSchema, "1234567");
    expectRejected(passwordSchema, "x".repeat(73));
  });
});

describe("registerSchema", () => {
  // NOTE: zod v4 runs `.email()` BEFORE `.trim()` (checks precede transforms),
  // so space-padded emails fail validation — fixtures use mixed case instead to
  // exercise the toLowerCase normalization.
  const valid = { name: "Umutoni Alice", email: "Alice@Zubeli.RW", password: "Password123!", phone: "+250788123456" };

  it("accepts a valid registration and normalizes email/phone", () => {
    const result = registerSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("alice@zubeli.rw");
      expect(result.data.phone).toBe("+250788123456");
    }
  });

  it("accepts missing phone and trims name", () => {
    const result = registerSchema.safeParse({ name: "  Bob ", email: "bob@zubeli.rw", password: "Password123!" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bob");
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("rejects invalid email", () => {
    expectRejected(registerSchema, { ...valid, email: "not-an-email" }, "email");
  });

  it("rejects too-short password", () => {
    expectRejected(registerSchema, { ...valid, password: "short" }, "password");
  });

  it("rejects too-short phone", () => {
    expectRejected(registerSchema, { ...valid, phone: "123" }, "phone");
  });

  it("rejects empty name", () => {
    expectRejected(registerSchema, { ...valid, name: " " }, "name");
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    // Mixed case (no spaces — .email() runs before .trim() in zod v4) exercises
    // the toLowerCase normalization.
    const result = loginSchema.safeParse({ email: "Alice@Zubeli.RW", password: "Password123!" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("alice@zubeli.rw");
  });

  it("rejects invalid email", () => {
    expectRejected(loginSchema, { email: "nope", password: "Password123!" }, "email");
  });

  it("rejects empty password", () => {
    expectRejected(loginSchema, { email: "a@b.rw", password: "" }, "password");
  });

  it("accepts a 1-char password — wrong-but-short must hit bcrypt.compare (uniform timing)", () => {
    const result = loginSchema.safeParse({ email: "a@b.rw", password: "x" });
    expect(result.success).toBe(true);
  });
});

describe("profileSchema", () => {
  it("accepts partial updates", () => {
    const result = profileSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });
  it("maps empty-string phone to null (clears the field)", () => {
    const result = profileSchema.safeParse({ phone: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeNull();
  });
  it("accepts explicit null phone", () => {
    const result = profileSchema.safeParse({ phone: null });
    expect(result.success).toBe(true);
  });
  it("rejects a too-short phone", () => {
    expectRejected(profileSchema, { phone: "123" }, "phone");
  });
  it("rejects an empty name when provided", () => {
    expectRejected(profileSchema, { name: " " }, "name");
  });
});

describe("cartItemSchema", () => {
  it("accepts a valid item and coerces numeric strings", () => {
    const result = cartItemSchema.safeParse({ productId: "prod-1", quantity: "3" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe(3);
  });
  it("accepts quantity 1 and 99 (bounds)", () => {
    expect(cartItemSchema.safeParse({ productId: "p", quantity: 1 }).success).toBe(true);
    expect(cartItemSchema.safeParse({ productId: "p", quantity: 99 }).success).toBe(true);
  });
  it("rejects quantity 0", () => {
    expectRejected(cartItemSchema, { productId: "p", quantity: 0 }, "quantity");
  });
  it("rejects quantity 100", () => {
    expectRejected(cartItemSchema, { productId: "p", quantity: 100 }, "quantity");
  });
  it("rejects fractional and empty productId", () => {
    expectRejected(cartItemSchema, { productId: "p", quantity: 1.5 }, "quantity");
    expectRejected(cartItemSchema, { productId: "", quantity: 1 }, "productId");
  });
  it("removeCartItemSchema requires a productId", () => {
    expect(removeCartItemSchema.safeParse({ productId: "p" }).success).toBe(true);
    expectRejected(removeCartItemSchema, { productId: "" }, "productId");
  });
});

describe("checkoutSchema — bankTransferReference conditional (ADR 0003)", () => {
  const customer = {
    name: "Umutoni Alice",
    phone: "+250788123456",
    email: "alice@zubeli.rw",
    address: "KN 5 Rd, Kigali",
    city: "Kigali",
  };

  it("accepts COD_CASH without a reference", () => {
    const result = checkoutSchema.safeParse({ customer, paymentMethod: "COD_CASH" });
    expect(result.success).toBe(true);
  });

  it("accepts COD_MOBILE_MONEY without a reference", () => {
    expect(checkoutSchema.safeParse({ customer, paymentMethod: "COD_MOBILE_MONEY" }).success).toBe(true);
  });

  it("accepts BANK_TRANSFER with a valid reference (4-40 letters/digits/dashes)", () => {
    const result = checkoutSchema.safeParse({ customer, paymentMethod: "BANK_TRANSFER", bankTransferReference: "TRF-8820136" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.bankTransferReference).toBe("TRF-8820136");
  });

  it("rejects BANK_TRANSFER without a reference", () => {
    expectRejected(checkoutSchema, { customer, paymentMethod: "BANK_TRANSFER" }, "bankTransferReference");
  });

  it("rejects BANK_TRANSFER with a malformed reference (too short / bad chars)", () => {
    expectRejected(checkoutSchema, { customer, paymentMethod: "BANK_TRANSFER", bankTransferReference: "AB" }, "bankTransferReference");
    expectRejected(checkoutSchema, { customer, paymentMethod: "BANK_TRANSFER", bankTransferReference: "bad ref!" }, "bankTransferReference");
  });

  it("rejects a reference on COD_CASH", () => {
    expectRejected(checkoutSchema, { customer, paymentMethod: "COD_CASH", bankTransferReference: "TRF-123" }, "bankTransferReference");
  });

  it("rejects reserved payment methods (MOMO_GATEWAY / CARD)", () => {
    expectRejected(checkoutSchema, { customer, paymentMethod: "MOMO_GATEWAY" }, "paymentMethod");
    expectRejected(checkoutSchema, { customer, paymentMethod: "CARD" }, "paymentMethod");
  });

  it("rejects missing customer fields", () => {
    expectRejected(checkoutSchema, { customer: { name: "A" }, paymentMethod: "COD_CASH" }, "customer.name");
    expectRejected(checkoutSchema, { paymentMethod: "COD_CASH", customer: { ...customer, phone: "123" } }, "customer.phone");
  });
});

describe("productSchema", () => {
  const base = {
    name: "Hammer 16oz",
    slug: "hammer-16oz",
    priceCents: 15000,
    categoryId: "cat-1",
  };

  it("applies defaults (stockQty 0, lowStock 5, unpublished, no images)", () => {
    const result = productSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stockQty).toBe(0);
      expect(result.data.lowStockThreshold).toBe(5);
      expect(result.data.isPublished).toBe(false);
      expect(result.data.featured).toBe(false);
      expect(result.data.imageUrls).toEqual([]);
    }
  });

  it("accepts full input with explicit values", () => {
    const result = productSchema.safeParse({ ...base, stockQty: 10, lowStockThreshold: 3, isPublished: true, featured: true, imageUrls: ["/a.svg", "/b.svg"] });
    expect(result.success).toBe(true);
  });

  it("rejects negative priceCents", () => {
    expectRejected(productSchema, { ...base, priceCents: -1 }, "priceCents");
  });

  it("rejects zero priceCents (price must be positive)", () => {
    expectRejected(productSchema, { ...base, priceCents: 0 }, "priceCents");
  });

  it("rejects negative stock", () => {
    expectRejected(productSchema, { ...base, stockQty: -5 }, "stockQty");
  });

  it("rejects bad slugs (uppercase / underscores / leading dash)", () => {
    expectRejected(productSchema, { ...base, slug: "Hammer" }, "slug");
    expectRejected(productSchema, { ...base, slug: "hammer_16oz" }, "slug");
    expectRejected(productSchema, { ...base, slug: "-hammer" }, "slug");
  });

  it("rejects more than 8 images", () => {
    expectRejected(productSchema, { ...base, imageUrls: Array.from({ length: 9 }, (_, i) => `/img${i}.svg`) }, "imageUrls");
  });

  it("adminUpdateProductSchema requires a productId and tolerates partial fields", () => {
    const result = adminUpdateProductSchema.safeParse({ productId: "p1", priceCents: 100 });
    expect(result.success).toBe(true);
    expectRejected(adminUpdateProductSchema, { priceCents: 100 }, "productId");
    expectRejected(adminUpdateProductSchema, { productId: "p1", priceCents: -2 }, "priceCents");
  });
});

describe("stockAdjustSchema", () => {
  it("accepts IN with default direction and note", () => {
    const result = stockAdjustSchema.safeParse({ productId: "p1", quantity: 5, reason: "RESTOCK" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.direction).toBe("IN");
  });

  it("accepts OUT with ADJUSTMENT", () => {
    const result = stockAdjustSchema.safeParse({ productId: "p1", quantity: 2, reason: "ADJUSTMENT", direction: "OUT" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.direction).toBe("OUT");
  });

  it("rejects quantity 0 and 10001", () => {
    expectRejected(stockAdjustSchema, { productId: "p1", quantity: 0, reason: "RESTOCK" }, "quantity");
    expectRejected(stockAdjustSchema, { productId: "p1", quantity: 10001, reason: "RESTOCK" }, "quantity");
  });

  it("rejects unknown reasons and directions", () => {
    expectRejected(stockAdjustSchema, { productId: "p1", quantity: 1, reason: "ORDER" }, "reason");
    expectRejected(stockAdjustSchema, { productId: "p1", quantity: 1, reason: "RESTOCK", direction: "SIDE" }, "direction");
  });
});

describe("order-related schemas", () => {
  it("orderStatusSchema accepts only the five statuses", () => {
    for (const s of ["PENDING", "PAID", "FULFILLED", "CANCELLED", "REFUNDED"]) {
      expect(orderStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(orderStatusSchema.safeParse("SHIPPED").success).toBe(false);
  });

  it("pageParamsSchema clamps limit to 1..100", () => {
    expect(pageParamsSchema.safeParse({ limit: 25 }).success).toBe(true);
    expect(pageParamsSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(pageParamsSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("adminListOrdersSchema accepts status + paymentMethod filters", () => {
    const ok = adminListOrdersSchema.safeParse({ status: "PAID", paymentMethod: "BANK_TRANSFER", search: "ZBL", limit: 10 });
    expect(ok.success).toBe(true);
    expectRejected(adminListOrdersSchema, { status: "SHIPPED" }, "status");
    expectRejected(adminListOrdersSchema, { paymentMethod: "BITCOIN" }, "paymentMethod");
  });

  it("adminListCustomersSchema accepts search", () => {
    expect(adminListCustomersSchema.safeParse({ search: "umutoni" }).success).toBe(true);
  });

  it("salesPeriodSchema rejects from > to", () => {
    expect(salesPeriodSchema.safeParse({ from: "2026-01-01", to: "2026-02-01" }).success).toBe(true);
    expectRejected(salesPeriodSchema, { from: "2026-02-01", to: "2026-01-01" }, "from");
  });

  it("revenueMonthsSchema rejects 0 and 37", () => {
    expect(revenueMonthsSchema.safeParse({ months: 12 }).success).toBe(true);
    expect(revenueMonthsSchema.safeParse({ months: 0 }).success).toBe(false);
    expect(revenueMonthsSchema.safeParse({ months: 37 }).success).toBe(false);
  });

  it("topProductsSchema defaults to 5 and caps at 50", () => {
    const result = topProductsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(5);
    expect(topProductsSchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it("adminListProductsSchema accepts includeDeleted", () => {
    expect(adminListProductsSchema.safeParse({ includeDeleted: true }).success).toBe(true);
  });

  it("listMovementsSchema accepts optional productId filter", () => {
    expect(listMovementsSchema.safeParse({ productId: "p1", limit: 5 }).success).toBe(true);
    expectRejected(listMovementsSchema, { limit: 0 }, "limit");
  });
});
