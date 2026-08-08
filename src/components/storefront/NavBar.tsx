"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CategoryDropdown, type CategoryLink } from "./CategoryDropdown";
import { cx } from "@/components/ui";

/**
 * Desktop primary navigation — Home + Products + the category popover.
 * Client component (usePathname drives the active-route state; the `categories`
 * prop is plain serializable data passed down from the server layout).
 * Active link gets a brand pill + aria-current="page" (ui-ux-pro-max audit #9).
 * Note: text-ink and text-brand-700 have equal specificity, so they must be
 * mutually exclusive in the class list — never both on the same element.
 */
export function NavBar({ categories }: { categories: CategoryLink[] }) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const onProducts = pathname === "/products" || pathname.startsWith("/products");

  const linkClasses =
    "flex h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors hover:bg-stone-100";
  const activeClasses = "bg-brand-50 text-brand-700";

  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      <Link
        href="/"
        aria-current={onHome ? "page" : undefined}
        className={cx(linkClasses, onHome ? activeClasses : "text-ink")}
      >
        Home
      </Link>
      <Link
        href="/products"
        aria-current={onProducts ? "page" : undefined}
        className={cx(linkClasses, onProducts ? activeClasses : "text-ink")}
      >
        Products
      </Link>
      <CategoryDropdown categories={categories} />
    </nav>
  );
}
