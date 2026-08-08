import Link from "next/link";
import { CategoryDropdown, type CategoryLink } from "./CategoryDropdown";

/**
 * Desktop primary navigation — Home + Products + the category popover.
 * Server component receiving categories (from listAll via the store layout).
 */
export function NavBar({ categories }: { categories: CategoryLink[] }) {
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      <Link
        href="/"
        className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-stone-100"
      >
        Home
      </Link>
      <Link
        href="/products"
        className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-stone-100"
      >
        Products
      </Link>
      <CategoryDropdown categories={categories} />
    </nav>
  );
}