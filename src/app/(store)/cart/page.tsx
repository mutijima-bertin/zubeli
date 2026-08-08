import type { Metadata } from "next";
import { CartLineItems } from "./_components/CartLineItems";
import { CheckoutCta } from "./_components/CheckoutCta";
import { OrderSummary } from "./_components/OrderSummary";

export const metadata: Metadata = {
  title: "Your Cart | Zubeli",
  description:
    "Review the tools in your cart and check out in minutes. Pay on delivery — cash, mobile money or bank transfer.",
};

/**
 * Cart screen (Phase C-3 — cart-agent). Server shell, NO data fetching:
 * cart state lives in the shared CartProvider mounted by the (store) layout.
 * The layout passes a server-rendered cart when a session/cart cookie
 * exists; first-time guests hydrate client-side via getCartAction(). Every
 * child reads useCart() directly, so the header badge, line items and the
 * order summary stay in sync after each mutation (actions revalidate the
 * cart server-side — no router.refresh() needed here).
 */
export default function CartPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Your cart</h1>
      <p className="mt-1 text-sm text-stone-600 sm:text-base">
        Review the tools for your next build.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <CartLineItems />
        <aside className="min-w-0">
          <div className="space-y-4 lg:sticky lg:top-6">
            <OrderSummary />
            <CheckoutCta />
          </div>
        </aside>
      </div>
    </div>
  );
}
