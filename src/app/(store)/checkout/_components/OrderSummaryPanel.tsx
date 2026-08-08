"use client";
/**
 * Sticky order summary (Phase C-4 — checkout-agent). Reads the shared
 * useCart context — same source of truth as the cart screen, so quantities
 * edited elsewhere stay in sync. Compact line list + subtotal / delivery /
 * total, all through the Price primitive.
 */
import Image from "next/image";
import { Card, CardBody, IconBox, Price } from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";

export function OrderSummaryPanel() {
  const { cart } = useCart();

  if (!cart || cart.items.length === 0) return null;

  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Card>
      <CardBody className="px-5 py-5">
        <h2 className="text-base font-semibold text-ink">Order summary</h2>

        <ul role="list" className="mt-4 space-y-3">
          {cart.items.map((item) => {
            const imageUrl = item.product.imageUrls[0] ?? null;
            return (
              <li key={item.id} className="flex items-center gap-3">
                <span className="relative block size-10 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-stone-100">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-cover"
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-stone-300">
                      <IconBox className="size-5" />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.product.name}</p>
                  <p className="text-xs text-stone-500">
                    {item.quantity} × <Price cents={item.product.priceCents} currency={cart.currency} size="sm" />
                  </p>
                </div>
                <Price cents={item.lineTotalCents} currency={cart.currency} size="sm" />
              </li>
            );
          })}
        </ul>

        <dl className="mt-4 space-y-3 border-t border-stone-100 pt-4 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-stone-600">
              Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
            </dt>
            <dd className="font-medium text-ink">
              <Price cents={cart.subtotalCents} currency={cart.currency} size="sm" />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-stone-600">Delivery</dt>
            <dd className="font-medium text-ink">
              <Price cents={cart.deliveryFeeCents} currency={cart.currency} size="sm" />
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
