import Link from "next/link";
import { NotificationBell } from "@/components/ui";
import { AccountMenu } from "./AccountMenu";
import { CartBadge } from "./CartBadge";
import { MobileMenu } from "./MobileMenu";
import { NavBar } from "./NavBar";
import { SearchBox } from "./SearchBox";

/**
 * Storefront header — server component. Receives the session user + category
 * counts from the (store) layout (single fetch, no double cookie churn) and
 * composes the client search / account / cart / mobile-menu primitives.
 * Includes the skip-to-content link for keyboard users.
 */
export function Header({
  user,
  categories,
}: {
  user: { id: string; name: string; email: string; role: "OWNER" | "CUSTOMER" } | null;
  categories: { slug: string; name: string; productCount: number }[];
}) {
  const accountUser = user ? { name: user.name, email: user.email, role: user.role } : null;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6 lg:px-8">
        <MobileMenu user={accountUser} categories={categories} />
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-lg"
          aria-label="Zubeli — home"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-base font-black text-ink-dark">
            Z
          </span>
          <span className="text-lg font-bold tracking-tight text-ink">Zubeli</span>
        </Link>

        <NavBar categories={categories} />

        <div className="ml-auto flex items-center gap-1.5">
          <SearchBox className="hidden w-56 md:block lg:w-64" />
          {user && <NotificationBell userId={user.id} />}
          <AccountMenu user={accountUser} />
          <CartBadge />
        </div>
      </div>
    </header>
  );
}