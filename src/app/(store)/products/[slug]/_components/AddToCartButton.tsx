"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, IconCart, useToast } from "@/components/ui";
import { useCart } from "@/lib/hooks/useCart";
import type { ProductDTO } from "@/types/api";
import { QuantityPicker } from "./QuantityPicker";

/**
 * Add-to-cart buy box. Owns the quantity state so the picker and the CTA
 * stay in sync, then delegates the mutation to the shared `useCart.add`
 * (server caps quantity at stock — the action result is authoritative).
 *
 * Feedback: success/failure Toast (provider mounted in the store layout)
 * + inline `role="alert"` error under the control. The page does not
 * navigate; the header badge updates via the shared cart context, and
 * `router.refresh()` keeps server-rendered sections fresh.
 */
export function AddToCartButton({ product }: { product: ProductDTO }) {
  const { add } = useCart();
  const { toast } = useToast();
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const outOfStock = product.stockQty <= 0;

  async function handleAdd() {
    if (outOfStock || isAdding) return;
    setIsAdding(true);
    setError(null);
    const result = await add(product.id, quantity);
    if (result.ok) {
      toast({
        title: "Added to cart",
        message: `${quantity} × ${product.name}`,
        tone: "success",
      });
      router.refresh();
    } else {
      // e.g. PRODUCT_OUT_OF_STOCK — the server is authoritative on stock.
      setError(result.error.message);
      toast({
        title: "Could not add to cart",
        message: result.error.message,
        tone: "danger",
      });
    }
    setIsAdding(false);
  }

  return (
    <div className="space-y-3">
      <QuantityPicker
        value={quantity}
        onChange={(next) => {
          setQuantity(next);
          setError(null);
        }}
        max={Math.max(product.stockQty, 1)}
        disabled={outOfStock || isAdding}
      />

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-700">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={isAdding}
        disabled={outOfStock}
        onClick={handleAdd}
      >
        <IconCart className="size-5" aria-hidden="true" />
        {outOfStock ? "Out of stock" : "Add to cart"}
      </Button>
    </div>
  );
}
