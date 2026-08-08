"use client";
/**
 * Storefront product interactions. `quickAdd` is the ProductCard add-to-cart
 * bridge: adds through `useCart` and surfaces OUT_OF_STOCK / validation
 * failures as toasts. `pending` disables the button while in flight.
 */
import { useCallback, useMemo } from "react";
import { useToast } from "@/components/ui";
import { useCart } from "./useCart";

export function useProducts() {
  const { add, pending } = useCart();
  const { toast } = useToast();

  const quickAdd = useCallback(
    async (productId: string, quantity = 1) => {
      const result = await add(productId, quantity);
      if (result.ok) {
        toast({ tone: "success", title: "Added to cart" });
      } else if (result.error.code === "OUT_OF_STOCK") {
        toast({ tone: "warning", title: "Out of stock", message: result.error.message });
      } else if (result.error.code === "VALIDATION") {
        toast({ tone: "warning", title: "Could not add to cart", message: result.error.message });
      } else {
        toast({ tone: "danger", title: "Could not add to cart", message: result.error.message });
      }
      return result;
    },
    [add, toast],
  );

  return useMemo(() => ({ pending, quickAdd }), [pending, quickAdd]);
}

export type UseProductsResult = {
  pending: boolean;
  quickAdd: (productId: string, quantity?: number) => Promise<
    | { ok: true; data: import("@/types/api").CartDTO }
    | { ok: false; error: import("@/types/api").ApiError }
  >;
};