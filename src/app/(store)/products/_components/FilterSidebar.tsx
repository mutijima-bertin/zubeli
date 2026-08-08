"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Dialog, cx } from "@/components/ui";
import type { CategoryWithCount } from "@/lib/db/categories";
import type { ProductSort } from "@/lib/db/products";

type Chip = { slug: string | null; name: string; count: number };

/**
 * Build a category-filter link that preserves the active search (`q`) and
 * sort and NEVER carries a cursor — filter changes must reset pagination
 * (catalog search-params contract, build plan §C).
 */
function buildHref({ cat, q, sort }: { cat?: string; q: string | null; sort: ProductSort }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (sort !== "newest") params.set("sort", sort);
  if (cat) params.set("cat", cat);
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

/**
 * Category chips + live product counts. Server data comes in as serializable
 * props; chips are real links (shareable, back-button safe). On mobile the
 * list collapses into a slide-in dialog; on lg+ it is an inline sidebar.
 */
export function FilterSidebar({
  categories,
  activeCat,
  q,
  sort,
}: {
  categories: CategoryWithCount[];
  activeCat: string | null;
  q: string | null;
  sort: ProductSort;
}) {
  const [open, setOpen] = useState(false);

  const chips: Chip[] = [
    {
      slug: null,
      name: "All tools",
      count: categories.reduce((sum, category) => sum + category.productCount, 0),
    },
    ...categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      count: category.productCount,
    })),
  ];

  return (
    <>
      {/* Mobile trigger — drawer version of the same list */}
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          fullWidth
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
        >
          Filters
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Filters" side="end">
        <div className="p-4">
          <CategoryNav
            chips={chips}
            activeCat={activeCat}
            q={q}
            sort={sort}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </Dialog>

      {/* Desktop sidebar */}
      <aside aria-label="Filters" className="hidden lg:sticky lg:top-24 lg:block">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Categories
        </h2>
        <CategoryNav chips={chips} activeCat={activeCat} q={q} sort={sort} />
      </aside>
    </>
  );
}

function CategoryNav({
  chips,
  activeCat,
  q,
  sort,
  onNavigate,
}: {
  chips: Chip[];
  activeCat: string | null;
  q: string | null;
  sort: ProductSort;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Category filters">
      <ul className="mt-3 space-y-1">
        {chips.map((chip) => {
          const active = chip.slug === activeCat;
          return (
            <li key={chip.slug ?? "all"}>
              <Link
                href={buildHref({ cat: chip.slug ?? undefined, q, sort })}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-stone-700 hover:bg-stone-100 hover:text-ink",
                )}
              >
                <span>{chip.name}</span>
                <span className="text-xs tabular-nums text-stone-500">{chip.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
