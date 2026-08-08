"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { IconSearch } from "@/components/ui";
import { cx } from "@/components/ui";

/**
 * Storefront search — client GET form that navigates to /products?q=…
 * (catalog-agent owns the page; this is the navigation contract).
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  }

  return (
    <form role="search" onSubmit={onSubmit} className={cx("relative", className)}>
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tools…"
        autoComplete="off"
        className="h-11 w-full rounded-full border border-stone-300 bg-white pl-9 pr-12 text-sm text-ink placeholder:text-stone-400 transition-colors focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      <button
        type="submit"
        aria-label="Submit search"
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-brand-100 hover:text-brand-800"
      >
        <IconSearch className="size-4" />
      </button>
    </form>
  );
}