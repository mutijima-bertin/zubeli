"use client";
import { Button, IconArrowRight } from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";

/**
 * Checkout CTA (Phase C-3 — cart-agent): primary link to /checkout.
 * Hidden while the cart is loading and on the empty state (the
 * EmptyCartState browse-back CTA owns that UX) — no dead disabled button.
 * Pay-on-delivery reassurance sits right under the CTA (MVP payment model).
 */
export function CheckoutCta() {
  const { cart } = useCart();

  if (!cart || cart.items.length === 0) return null;

  return (
    <div className="space-y-3">
      <Button href="/checkout" size="lg" fullWidth>
        Proceed to checkout
        <IconArrowRight className="size-4" aria-hidden="true" />
      </Button>
      <p className="text-center text-xs text-stone-500">
        Pay on delivery — cash, mobile money or bank transfer.
      </p>
    </div>
  );
}
