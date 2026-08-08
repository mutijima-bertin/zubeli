"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@/components/ui";
import { cx } from "@/components/ui";

export type CategoryLink = { slug: string; name: string; productCount: number };

/**
 * Desktop "Categories" popover (disclosure pattern: aria-expanded on the
 * button, plain links inside — no role=menu so links stay plain links for
 * assistive tech). Esc / click-outside closes; focus returns to the button
 * position naturally as the panel unmounts before the next Tab.
 */
export function CategoryDropdown({ categories }: { categories: CategoryLink[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink transition-colors hover:bg-stone-100"
      >
        Categories
        <IconChevronDown className={cx("size-4 text-stone-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-stone-200 bg-white p-2 shadow-pop">
          <div className="flex flex-col">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/products?cat=${category.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-stone-50"
              >
                <span>{category.name}</span>
                <span className="text-xs tabular-nums text-stone-400">{category.productCount}</span>
              </Link>
            ))}
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg border-t border-stone-100 px-3 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              View all products
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}