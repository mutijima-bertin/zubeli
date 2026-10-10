"use client";
import { Card, CardBody, Price } from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";

/**
 * Order summary (Phase C-3 — cart-agent): subtotal / total from the
 * authoritative CartDTO (no delivery fee — total === subtotal), all through
 * formatRWF via the Price primitive.
 * Hidden while the cart is loading or empty (EmptyCartState owns that UX).
 */
export function OrderSummary() {
  const { cart } = useCart();

  if (!cart || cart.items.length === 0) return null;

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card>
      <CardBody className="px-5 py-5">
        <h2 className="text-base font-semibold text-ink">Order summary</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-stone-600">
              Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
            </dt>
            <dd className="font-medium text-ink">
              <Price cents={cart.subtotalCents} currency={cart.currency} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-stone-100 pt-3">
            <dt className="text-base font-semibold text-ink">Total</dt>
            <dd className="text-ink">
              <Price cents={cart.totalCents} currency={cart.currency} size="md" />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-stone-500">All prices include VAT.</p>
      </CardBody>
    </Card>
  );
}
