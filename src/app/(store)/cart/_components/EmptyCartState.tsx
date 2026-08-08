import { Button, EmptyState, IconArrowRight, IconCart } from "@/components/ui";

/**
 * Empty-cart state (Phase C-3 — cart-agent): icon + browse-back CTA.
 * Rendered by CartLineItems when the shared cart has no line items —
 * reactively covers "removed the last item" too.
 */
export function EmptyCartState() {
  return (
    <EmptyState
      icon={<IconCart className="size-6" />}
      title="Your cart is empty"
      description="Browse the catalog and add the tools you need for your next build."
      action={
        <Button href="/products" size="lg">
          Browse products
          <IconArrowRight className="size-4" aria-hidden="true" />
        </Button>
      }
    />
  );
}
