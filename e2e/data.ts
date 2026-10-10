/**
 * Shared test fixtures (owned by e2e-runner). Values mirror prisma/seed.ts —
 * stable across reseeds, so specs may assert on them. Read-only; e2e/ never
 * modifies app code, prisma/ or docs/.
 */

export const DEMO_PASSWORD = "DemoPass2026!";

/** Seeded demo customers (prisma/seed.ts §Users). */
export const CUSTOMER_UMUTONI = { email: "umutoni@demo.rw", name: "Umutoni Claudine" };
export const CUSTOMER_ERIC = { email: "eric@demo.rw", name: "Eric Mugisha" };

/** Seeded owner credentials (prisma/seed.ts §Users — SEED_ADMIN_* defaults). */
export const OWNER_EMAIL = "owner@zubeli.rw";
export const OWNER_PASSWORD = DEMO_PASSWORD;
export const OWNER_NAME = "Zubeli Owner";

/** Seed order facts used by the admin orders journey. */
export const ORDER_PENDING_BANK_TRANSFER = { number: "ZBL-00000014", ref: "TRF-8820136" };
export const ORDER_CANCELLED_SEED = "ZBL-00000011";

/** Seeded guest order customer (customerId null → Guest badge on /admin/customers). */
export const GUEST_CUSTOMER = { name: "Jean Bosco Niyonzima", phone: "+250788112233" };

/** Admin nav — the single source of truth is src/components/admin/nav.ts. */
export const ADMIN_NAV_LINKS = ["Overview", "Products", "Stock", "Orders", "Customers", "Sales"];

/** Seeded product facts used by catalog/cart/checkout assertions. */
export const ANGLE_GRINDER = {
  slug: "angle-grinder",
  name: "Angle Grinder 125mm",
  priceRwf: "65,000 RWF",
  priceCents: 65_000,
};
export const CLAW_HAMMER = {
  slug: "claw-hammer",
  name: "Claw Hammer 500g",
  priceRwf: "12,500 RWF",
  priceCents: 12_500,
};
export const WHEELBARROW = {
  slug: "wheelbarrow",
  name: "Wheelbarrow 100L",
  priceRwf: "48,000 RWF",
  priceCents: 48_000,
};
export const SAFETY_VEST = { slug: "safety-vest", name: "Hi-Vis Safety Vest", priceRwf: "6,500 RWF" };

/** Published=false in the seed — must never appear in the catalog. */
export const UNPUBLISHED_PRODUCT = "Waterproofing Membrane";

/** Guest checkout shipping details (Kigali). */
export const KIGALI_ADDRESS = {
  name: "E2E Guest",
  phone: "+250788000111",
  email: "e2e-guest@example.com",
  address: "KG 7 Ave, Kimironko",
  city: "Kigali",
};

/**
 * Orders created through the UI get `ZBL-` + 8 hex chars (src/lib/db/orders.ts
 * generateOrderNumber). The seeded demo orders use ZBL-00000001..15.
 */
export const ORDER_NUMBER_RE = /^ZBL-[0-9A-F]{8}$/;

/** MoMo pay-at-door copy (number comes from site config — keep it robust). */
export const MOMO_COPY_RE = /Pay at the door via MTN MoMo or Airtel Money/;

/**
 * The three methods the storefront CAN offer (prisma PaymentMethod enum, the
 * checkout PAYMENT_OPTIONS catalogue). WHICH of them is offered is
 * configuration (`PAYMENT_METHODS` → siteConfig.paymentMethods), so specs
 * discover the real offer from the rendered radios instead of assuming one.
 */
export type StorefrontPaymentMethod = "COD_CASH" | "COD_MOBILE_MONEY" | "BANK_TRANSFER";

/**
 * Customer-facing method badge (src/lib/format.ts PAYMENT_METHOD_META). Stored
 * per order, so this copy is independent of the current allowlist.
 */
export const PAYMENT_BADGE: Record<StorefrontPaymentMethod, string> = {
  COD_CASH: "Pay on delivery — Cash",
  COD_MOBILE_MONEY: "Pay on delivery — Mobile Money",
  BANK_TRANSFER: "Bank transfer",
};

/**
 * First "How to pay" instruction for a placed order
 * (src/lib/payments buildPaymentInstructions). Kept per method so a spec can
 * assert the confirmation of whichever method it actually placed.
 */
export const PAYMENT_INSTRUCTION: Record<StorefrontPaymentMethod, string | RegExp> = {
  COD_CASH: "Pay in cash when your order arrives.",
  COD_MOBILE_MONEY: MOMO_COPY_RE,
  BANK_TRANSFER: /order number ZBL-[0-9A-F]{8} as your transfer reference/,
};

/** Unique email per registration — the shared DB accumulates users across runs. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}@example.com`;
}

/** Unique bank transfer reference (4–40 letters/digits/dashes). */
export function uniqueBankReference(): string {
  return `E2E-BT-${Date.now()}`;
}

/** Unique admin product slug (lowercase letters, digits and dashes only). */
export function uniqueProductSlug(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}`;
}

/** Unique Rwandan mobile number (+250 7XX XXX XXX). */
export function uniquePhone(): string {
  const tail = String(Date.now()).slice(-7);
  return `+250781${tail}`;
}

/** Local date N days ago as a "YYYY-MM-DD" string (for <input type="date">). */
export function dateDaysAgoInput(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** en-GB "9 Apr 2026" — matches the server's formatDate() (src/lib/format.ts). */
export function formatDateGb(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
