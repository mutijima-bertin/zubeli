"use client";
/**
 * Quick add-to-cart for product cards (catalog / homepage / related grids).
 *
 * Owner ask #1: add to cart straight from a card — no product-page visit.
 * Delegates the mutation to the shared `useCart.add` (wraps the
 * addToCartAction server action; the server caps quantity at stock and is
 * authoritative on availability). Works for guests (cart_token cookie) and
 * logged-in users transparently.
 *
 * Rendered inside ProductCard's `actions` slot — structurally OUTSIDE the
 * card's Link, so clicks never trigger card navigation (preventDefault +
 * stopPropagation kept as belt-and-suspenders if a screen ever nests the
 * button inside a link).
 *
 * Feedback: success/failure Toast (provider mounted in the store layout);
 * `router.refresh()` keeps server-rendered sections (header CartBadge)
 * fresh. `useTransition` keeps the grid interactive while the action is in
 * flight and blocks double-clicks via the Button `loading` state.
 *
 * Disabled + "Out of stock" only when stockQty <= 0 — mirrors the card's
 * badge heuristic, so low-stock (≤ 5) stays buyable.
 */
import { useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, IconCart, useToast } from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";

export function QuickAddToCartButton({
  productId,
  stockQty,
  slug,
  className,
}: {
  productId: string;
  stockQty: number;
  /** Human-readable product identifier for the aria-label (optional). */
  slug?: string;
  className?: string;
}) {
  const { add } = useCart();
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const outOfStock = stockQty <= 0;

  function handleAdd(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (outOfStock || isPending) return;

    startTransition(async () => {
      const result = await add(productId, 1);
      if (result.ok) {
        toast({ title: "Added to cart", tone: "success" });
        router.refresh();
      } else {
        // e.g. PRODUCT_OUT_OF_STOCK — the server is authoritative on stock.
        toast({
          title: "Could not add to cart",
          message: result.error.message,
          tone: "danger",
        });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      fullWidth
      loading={isPending}
      disabled={outOfStock}
      onClick={handleAdd}
      aria-label={slug ? `Add ${slug} to cart` : undefined}
      className={className}
    >
      <IconCart className="size-4" aria-hidden="true" />
      {outOfStock ? "Out of stock" : "Add to cart"}
    </Button>
  );
}
