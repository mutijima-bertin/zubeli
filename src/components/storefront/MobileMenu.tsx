"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/actions/auth";
import { Button, Dialog, IconMenu } from "@/components/ui";
import type { CategoryLink } from "./CategoryDropdown";
import { SearchBox } from "./SearchBox";
import type { AccountMenuUser } from "./AccountMenu";

/**
 * Mobile navigation — hamburger opens a right slide-in dialog (shared
 * Dialog primitive: focus trap, Esc/overlay close). Duplicates the desktop
 * NavBar links for small screens (mobile-first, no hover-only access).
 */
export function MobileMenu({
  user,
  categories,
}: {
  user: AccountMenuUser;
  categories: CategoryLink[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function signOut() {
    await logoutAction();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex size-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-stone-100 lg:hidden"
      >
        <IconMenu className="size-6" />
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} side="end" title="Menu" label="Main menu">
        <div className="flex flex-col gap-6 p-5">
          <SearchBox />

          <nav aria-label="Main menu" className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-stone-50"
            >
              Home
            </Link>
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-stone-50"
            >
              All products
            </Link>
          </nav>

          <div>
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-stone-500">
              Categories
            </p>
            <nav aria-label="Categories" className="flex flex-col gap-1">
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/products?cat=${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-stone-50"
                >
                  <span>{category.name}</span>
                  <span className="text-xs tabular-nums text-stone-400">{category.productCount}</span>
                </Link>
              ))}
            </nav>
          </div>

          {user ? (
            <div className="flex flex-col gap-2 border-t border-stone-100 pt-4">
              <p className="px-3 text-sm font-semibold text-ink">{user.name}</p>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-stone-50"
              >
                My account
              </Link>
              <Link
                href="/account/orders"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-stone-50"
              >
                Order history
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut} className="justify-start px-3">
                Sign out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 border-t border-stone-100 pt-4">
              <Button href="/login" fullWidth>
                Sign in
              </Button>
              <Button href="/register" variant="outline" fullWidth>
                Create account
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}