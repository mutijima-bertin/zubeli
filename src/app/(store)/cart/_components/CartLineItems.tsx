"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  IconBox,
  IconTrash,
  Price,
  QuantityStepper,
  Skeleton,
  useToast,
} from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";
import type { CartItemDTO } from "@/types/api";
import { EmptyCartState } from "./EmptyCartState";

const SKELETON_ROWS = [0, 1, 2];

/**
 * Cart line items (Phase C-3 — cart-agent). Client component bound to the
 * shared useCart hook: steppers call updateQty (capped at stockQty), the
 * trash button calls remove. The last successful mutation drives the
 * context state, so the header badge, order summary and this list all
 * update without router.refresh().
 *
 * States: skeletons while the provider hydrates → EmptyCartState when the
 * cart has no items → the list. Out-of-stock lines (stockQty 0) show a
 * Badge and a disabled stepper.
 */
export function CartLineItems() {
  const { cart, updateQty, remove, pending, error } = useCart();
  const { toast } = useToast();
  /** Which product's remove button shows the inline spinner. */
  const [busyId, setBusyId] = useState<string | null>(null);

  // First load (guest) or refresh in flight — skeletons avoid layout shift.
  if (!cart) {
    return (
      <Card aria-hidden="true">
        <ul role="list" className="divide-y divide-stone-100">
          {SKELETON_ROWS.map((i) => (
            <li key={i} className="flex gap-4 px-4 py-5 sm:gap-5 sm:px-5">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-3 py-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-10 w-36" />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="lg:col-span-2">
        <EmptyCartState />
      </div>
    );
  }

  const handleQuantityChange = (item: CartItemDTO, quantity: number) => {
    // Absolute next value from the stepper; the server re-caps at stock.
    void updateQty(item.product.id, quantity);
  };

  const handleRemove = async (item: CartItemDTO) => {
    setBusyId(item.product.id);
    const result = await remove(item.product.id);
    setBusyId(null);
    if (result.ok) {
      toast({
        tone: "success",
        title: "Removed from cart",
        message: `${item.product.name} was removed.`,
      });
    }
  };

  return (
    <section aria-labelledby="cart-items-heading">
      <h2 id="cart-items-heading" className="sr-only">
        Items in your cart
      </h2>

      {error && (
        <Alert tone="danger" title="We couldn't update your cart" className="mb-4">
          {error}
        </Alert>
      )}

      <Card>
        <ul role="list" className="divide-y divide-stone-100">
          {cart.items.map((item) => {
            const product = item.product;
            const outOfStock = product.stockQty <= 0;
            const href = `/products/${product.slug}`;
            const imageUrl = product.imageUrls[0] ?? null;

            return (
              <li key={item.id} className="flex gap-4 px-4 py-5 sm:gap-5 sm:px-5">
                <Link
                  href={href}
                  tabIndex={-1}
                  aria-hidden="true"
                  className="shrink-0 self-start"
                >
                  <span className="relative block size-20 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={product.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-stone-300">
                        <IconBox className="size-8" />
                      </span>
                    )}
                  </span>
                </Link>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={href}
                        className="line-clamp-2 text-sm font-semibold text-ink transition-colors hover:text-brand-700 sm:text-base"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-sm text-stone-500">
                        <Price cents={product.priceCents} currency={product.currency} size="sm" /> each
                      </p>
                      {outOfStock && (
                        <Badge tone="danger" className="mt-2">
                          Out of stock
                        </Badge>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => void handleRemove(item)}
                      disabled={pending}
                      loading={busyId === product.id}
                      aria-label={`Remove ${product.name} from cart`}
                    >
                      <IconTrash className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(next) => handleQuantityChange(item, next)}
                      min={1}
                      max={product.stockQty}
                      disabled={outOfStock || pending}
                    />
                    <div className="text-left sm:text-right">
                      <p className="text-xs text-stone-500">Line total</p>
                      <Price cents={item.lineTotalCents} currency={product.currency} size="md" />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
