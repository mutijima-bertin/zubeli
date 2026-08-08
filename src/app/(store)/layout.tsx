import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { CART_COOKIE, getCart } from "@/lib/cart";
import { listAll } from "@/lib/db/categories";
import { Footer } from "@/components/storefront/Footer";
import { Header } from "@/components/storefront/Header";
import { CartProvider } from "@/lib/hooks/useCart";
import { ToastProvider } from "@/components/ui";

/**
 * Storefront shell (route group, no URL impact — build plan §0).
 * One server-side data pass: session user + category counts feed the Header;
 * cart state feeds the client CartProvider (live badge) via a shared context.
 *
 * Cookie-safety (Next 15.5: `cookies().set()` is only legal in Server
 * Actions / Route Handlers — never in a component render):
 * - `getCart()` is only called server-side when it CANNOT write a cookie
 *   (a session or a cart_token already exists) → it only reads.
 * - On a guest's very first visit the layout skips `getCart()`; the client
 *   CartProvider then fetches via `getCartAction()` (a Server Action, so it
 *   may create the cart_token cookie) and the badge fills in on hydration.
 */
export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const cartStore = await cookies();
  const hasCartToken = Boolean(cartStore.get(CART_COOKIE)?.value);
  const initialCart = session || hasCartToken ? await getCart() : null;
  const categories = await listAll();
  const user = session ? { id: session.id, name: session.name, email: session.email } : null;

  return (
    <ToastProvider>
      <CartProvider initialCart={initialCart}>
        <div className="flex min-h-dvh flex-col bg-white text-ink">
          <Header user={user} categories={categories} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </CartProvider>
    </ToastProvider>
  );
}