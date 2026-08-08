"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Dialog, Input, Label, cx } from "@/components/ui";
import type { CategoryWithCount } from "@/lib/db/categories";
import type { ProductSort } from "@/lib/db/products";
import type { AvailabilityFilter } from "@/types/api";

type Chip = { slug: string | null; name: string; count: number };

/** Every filter a link can carry — mirrors CatalogFilter (never the cursor). */
type FilterState = {
  q: string | null;
  cat: string | null;
  sort: ProductSort;
  minPrice: number | null;
  maxPrice: number | null;
  avail: AvailabilityFilter | null;
};

const AVAILABILITY_OPTIONS: { value: AvailabilityFilter; label: string }[] = [
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

/**
 * Build a filter link preserving every active filter (q, sort, price range,
 * availability) and NEVER carrying a cursor — filter changes must reset
 * pagination (catalog search-params contract).
 */
function buildHref(filters: Omit<FilterState, "cat"> & { cat?: string }): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.cat) params.set("cat", filters.cat);
  if (filters.minPrice !== null) params.set("minPrice", String(filters.minPrice));
  if (filters.maxPrice !== null) params.set("maxPrice", String(filters.maxPrice));
  if (filters.avail) params.set("avail", filters.avail);
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
}

/**
 * Category chips + live counts + price range + availability + clear-all.
 * Server data comes in as serializable props; every control is URL
 * navigation (server is the single source of truth). On mobile the whole
 * group collapses into a slide-in dialog; on lg+ it is an inline sidebar.
 */
export function FilterSidebar({
  categories,
  activeCat,
  q,
  sort,
  minPrice,
  maxPrice,
  avail,
}: {
  categories: CategoryWithCount[];
  activeCat: string | null;
  q: string | null;
  sort: ProductSort;
  minPrice: number | null;
  maxPrice: number | null;
  avail: AvailabilityFilter | null;
}) {
  const [open, setOpen] = useState(false);

  const filters: FilterState = { q, cat: activeCat, sort, minPrice, maxPrice, avail };
  const close = () => setOpen(false);

  return (
    <>
      {/* Mobile trigger — drawer version of the same filters */}
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
      <Dialog open={open} onClose={close} title="Filters" side="end">
        <div className="p-4">
          <SidebarContent filters={filters} categories={categories} onNavigate={close} />
        </div>
      </Dialog>

      {/* Desktop sidebar */}
      <aside aria-label="Filters" className="hidden lg:sticky lg:top-24 lg:block">
        <SidebarContent filters={filters} categories={categories} />
      </aside>
    </>
  );
}

/** Filters shared by the mobile dialog and the desktop rail. */
function SidebarContent({
  filters,
  categories,
  onNavigate,
}: {
  filters: FilterState;
  categories: CategoryWithCount[];
  onNavigate?: () => void;
}) {
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

  const hasActiveFilters =
    filters.q !== null ||
    filters.cat !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.avail !== null;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Categories
        </h2>
        <CategoryNav chips={chips} filters={filters} onNavigate={onNavigate} />
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Price</h2>
        <PriceFilter filters={filters} onNavigate={onNavigate} />
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Availability
        </h2>
        <AvailabilityNav filters={filters} onNavigate={onNavigate} />
      </section>

      {hasActiveFilters && (
        <Link
          href="/products"
          onClick={onNavigate}
          className="inline-block text-sm font-semibold text-brand-700 underline-offset-4 hover:underline"
        >
          Clear all filters
        </Link>
      )}
    </div>
  );
}

function CategoryNav({
  chips,
  filters,
  onNavigate,
}: {
  chips: Chip[];
  filters: FilterState;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Category filters">
      <ul className="mt-3 space-y-1">
        {chips.map((chip) => {
          const active = chip.slug === filters.cat;
          return (
            <li key={chip.slug ?? "all"}>
              <Link
                href={buildHref({ ...filters, cat: chip.slug ?? undefined })}
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

/**
 * Price range — client form (inputs aren't linkable). On apply it pushes
 * minPrice/maxPrice to the URL preserving q/cat/sort/avail and dropping the
 * cursor; empty input = no constraint (param stripped). Digit-only values are
 * sent as typed — the backend parses every param defensively (invalid input
 * is treated as absent, min > max is a legitimate 0-match range).
 */
function PriceFilter({
  filters,
  onNavigate,
}: {
  filters: FilterState;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const uid = useId();
  const [min, setMin] = useState(filters.minPrice === null ? "" : String(filters.minPrice));
  const [max, setMax] = useState(filters.maxPrice === null ? "" : String(filters.maxPrice));
  const [isPending, startTransition] = useTransition();

  // The URL is the single source of truth — sync the fields back whenever
  // the applied range changes (apply, back/forward, clear-all).
  useEffect(() => {
    setMin(filters.minPrice === null ? "" : String(filters.minPrice));
  }, [filters.minPrice]);
  useEffect(() => {
    setMax(filters.maxPrice === null ? "" : String(filters.maxPrice));
  }, [filters.maxPrice]);

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.cat) params.set("cat", filters.cat);
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    if (filters.avail) params.set("avail", filters.avail);
    const minValue = min.trim();
    const maxValue = max.trim();
    if (/^\d+$/.test(minValue)) params.set("minPrice", minValue);
    if (/^\d+$/.test(maxValue)) params.set("maxPrice", maxValue);
    const href = params.toString() ? `/products?${params.toString()}` : "/products";
    onNavigate?.();
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <form onSubmit={apply} className="mt-3 space-y-3">
      <div>
        <Label htmlFor={`${uid}-min-price`}>Min price (RWF)</Label>
        <Input
          id={`${uid}-min-price`}
          value={min}
          onChange={(event) => setMin(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="e.g. 10000"
        />
      </div>
      <div>
        <Label htmlFor={`${uid}-max-price`}>Max price (RWF)</Label>
        <Input
          id={`${uid}-max-price`}
          value={max}
          onChange={(event) => setMax(event.target.value)}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="e.g. 50000"
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        fullWidth
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        Apply
      </Button>
    </form>
  );
}

/**
 * Availability — single-select links. Clicking the ACTIVE option removes it
 * (toggle); links preserve q/cat/sort/minPrice/maxPrice and reset the cursor.
 * aria-pressed announces the applied state; one option is active at a time.
 */
function AvailabilityNav({
  filters,
  onNavigate,
}: {
  filters: FilterState;
  onNavigate?: () => void;
}) {
  const { q, cat, sort, minPrice, maxPrice, avail } = filters;
  return (
    <nav aria-label="Availability filters">
      <ul className="mt-3 space-y-1">
        {AVAILABILITY_OPTIONS.map((option) => {
          const active = option.value === avail;
          return (
            <li key={option.value}>
              <Link
                href={buildHref({
                  q,
                  cat: cat ?? undefined,
                  sort,
                  minPrice,
                  maxPrice,
                  avail: active ? null : option.value,
                })}
                onClick={onNavigate}
                aria-pressed={active}
                className={cx(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-stone-700 hover:bg-stone-100 hover:text-ink",
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}