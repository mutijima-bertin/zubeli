"use client";
/**
 * Live cart state for the storefront. `CartProvider` is mounted once in the
 * (store) layout with the server-rendered cart; every client component
 * (CartBadge, QuantityStepper rows, add-to-cart buttons) consumes the same
 * context, so the badge and line items stay in sync without extra fetches.
 *
 * Mutations call the existing cart server actions (src/actions/cart.ts) —
 * the server revalidates `cart:<id>` so server components re-read fresh
 * data on the next render. `refresh()` re-fetches the authoritative cart.
 *
 * Works for guests (cart_token cookie) and logged-in users transparently —
 * lib/cart resolves the active cart server-side.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  addToCartAction,
  getCartAction,
  removeCartItemAction,
  updateCartQtyAction,
} from "@/actions/cart";
import type { ActionResult, CartDTO } from "@/types/api";

export type UseCartResult = {
  /** Current cart, or null before the first successful load. */
  cart: CartDTO | null;
  /** Σ line quantities — drives the header badge. */
  itemCount: number;
  add: (productId: string, quantity: number) => Promise<ActionResult<CartDTO>>;
  updateQty: (productId: string, quantity: number) => Promise<ActionResult<CartDTO>>;
  remove: (productId: string) => Promise<ActionResult<CartDTO>>;
  /** Re-fetches the cart from the server (after actions or session change). */
  refresh: () => Promise<ActionResult<CartDTO>>;
  pending: boolean;
  /** Last action error message, cleared on the next action. */
  error: string | null;
};

function useCartController(initialCart: CartDTO | null): UseCartResult {
  const [cart, setCart] = useState<CartDTO | null>(initialCart);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (productId: string, quantity: number) => {
    setPending(true);
    setError(null);
    const result = await addToCartAction({ productId, quantity });
    if (result.ok) setCart(result.data);
    else setError(result.error.message);
    setPending(false);
    return result;
  }, []);

  const updateQty = useCallback(async (productId: string, quantity: number) => {
    setPending(true);
    setError(null);
    const result = await updateCartQtyAction({ productId, quantity });
    if (result.ok) setCart(result.data);
    else setError(result.error.message);
    setPending(false);
    return result;
  }, []);

  const remove = useCallback(async (productId: string) => {
    setPending(true);
    setError(null);
    const result = await removeCartItemAction({ productId });
    if (result.ok) setCart(result.data);
    else setError(result.error.message);
    setPending(false);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    const result = await getCartAction();
    if (result.ok) setCart(result.data);
    return result;
  }, []);

  const itemCount = useMemo(
    () => cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [cart],
  );

  return useMemo(
    () => ({ cart, itemCount, add, updateQty, remove, refresh, pending, error }),
    [cart, itemCount, add, updateQty, remove, refresh, pending, error],
  );
}

const CartContext = createContext<UseCartResult | null>(null);

export function CartProvider({
  initialCart,
  children,
}: {
  initialCart: CartDTO | null;
  children: React.ReactNode;
}) {
  const value = useCartController(initialCart);

  // Guest's very first visit: the layout skips getCart() (cookie-write
  // restriction), so pull the authoritative cart from the action once
  // mounted — a Server Action may create the cart_token cookie.
  useEffect(() => {
    if (!initialCart) {
      void value.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot hydrate
  }, []);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Reads the shared cart context. `CartProvider` is mounted by the (store)
 * layout — every screen under it shares one live cart (no duplicate state,
 * no extra fetches). Components outside a provider (e.g. standalone tests)
 * must wrap with <CartProvider initialCart={null}> — see useProducts.
 */
export function useCart(): UseCartResult {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within <CartProvider>");
  return ctx;
}