"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { ProductCardDTO } from "@/types/api";
import { PaginationBar } from "./PaginationBar";

/**
 * Results grid — client. The URL search params are the single source of
 * truth; this component only caches server-rendered pages so "load more"
 * can accumulate without re-fetching or client-side data duplication:
 *
 * - A cache keyed by `q|cat|sort|price|avail|cursor` maps each applied cursor
 *   to the accumulated list that was shown at that point. Back/forward
 *   navigation restores the exact list (no duplicates).
 * - When a new cursor arrives that was never seen (advance), the fresh
 *   server page is appended to the accumulated items.
 * - When any filter changes (q/cat/sort/minPrice/maxPrice/avail — or a link
 *   carries no cursor), the list is reset to the incoming server page.
 *
 * Grid renders shared ProductCard (no actions slot — add-to-cart lives on
 * the product page and cart, per build plan).
 */
export function ProductGrid({
  initialItems,
  nextCursor,
  hasMore,
}: {
  initialItems: ProductCardDTO[];
  nextCursor: string | null;
  hasMore: boolean;
}) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const cat = searchParams.get("cat") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const avail = searchParams.get("avail") ?? "";
  const cursor = searchParams.get("cursor") ?? null;
  const base = `${q}|${cat}|${sort}|${minPrice}|${maxPrice}|${avail}`;
  const key = `${base}|${cursor ?? ""}`;

  const [items, setItems] = useState<ProductCardDTO[]>(initialItems);
  const cacheRef = useRef<Map<string, ProductCardDTO[]> | null>(null);
  if (cacheRef.current === null) {
    cacheRef.current = new Map([[key, initialItems]]);
  }
  const lastRef = useRef<{ base: string; cursor: string | null } | null>(null);

  useEffect(() => {
    const cache = cacheRef.current;
    if (!cache) return;

    const cached = cache.get(key);
    if (cached) {
      setItems(cached);
      lastRef.current = { base, cursor };
      return;
    }

    const previous = lastRef.current;
    const isAdvance =
      previous !== null &&
      previous.base === base &&
      cursor !== null &&
      previous.cursor !== cursor;

    if (isAdvance) {
      // Load more: append the fresh server page to the accumulated list.
      setItems((current) => {
        const merged = [...current, ...initialItems];
        cache.set(key, merged);
        return merged;
      });
    } else {
      // Filter/sort change or direct cursor link: fresh page from the server.
      setItems(initialItems);
      cache.set(key, initialItems);
    }
    lastRef.current = { base, cursor };
  }, [base, cursor, key, initialItems]);

  const countLabel = `${items.length} ${items.length === 1 ? "product" : "products"}`;

  return (
    <div className="mt-6">
      <p role="status" className="text-sm text-stone-600">
        {countLabel}
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <PaginationBar hasMore={hasMore} nextCursor={nextCursor} />
    </div>
  );
}
