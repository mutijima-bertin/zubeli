"use client";
import Link from "next/link";
import { useCart } from "@/lib/hooks/useCart";
import { IconCart } from "@/components/ui";
import { cx } from "@/components/ui";

/**
 * Header cart link with a live item count. Reads the shared cart context,
 * so the badge updates the moment any add/update action completes —
 * no extra fetch, no router.refresh needed for the badge itself.
 */
export function CartBadge({ className }: { className?: string }) {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
      className={cx(
        "relative flex size-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-stone-100",
        className,
      )}
    >
      <IconCart className="size-6" />
      {itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1 text-xs font-bold text-white">
          {itemCount}
        </span>
      )}
    </Link>
  );
}