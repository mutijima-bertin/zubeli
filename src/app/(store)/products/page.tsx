import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalogPage } from "@/lib/storefront";
import { Button, EmptyState, IconSearch, Skeleton } from "@/components/ui";
import { FilterSidebar } from "./_components/FilterSidebar";
import { ProductGrid } from "./_components/ProductGrid";
import { SortSelect } from "./_components/SortSelect";

export const metadata: Metadata = {
  title: "Tools & Materials | Zubeli",
  description:
    "Browse construction tools, materials and safety gear in Rwanda. Order online at Zubeli and pay on delivery — cash, mobile money or bank transfer.",
};

type CatalogSearchParams = {
  q?: string | string[];
  cat?: string | string[];
  sort?: string | string[];
  cursor?: string | string[];
  minPrice?: string | string[];
  maxPrice?: string | string[];
  avail?: string | string[];
};

/** Search params may be repeated (?q=a&q=b) — take the first value. */
function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Loading placeholder for the sort control (Suspense fallback). */
function SortSkeleton() {
  return <Skeleton className="h-11 w-full sm:w-56" />;
}

/**
 * Catalog — /products (Phase C-1, catalog-agent).
 *
 * Server component: searchParams are the single source of truth for
 * filter/search/sort/cursor; one data pass via getCatalogPage (server-only
 * helper) feeds serializable props into small client components:
 *   - FilterSidebar (category chips + counts; links preserve q + sort, reset cursor)
 *   - SortSelect (client; pushes `sort`, resets cursor)
 *   - ProductGrid (client; accumulates pages across cursor pushes)
 *   - PaginationBar (client; appends `cursor` via shared PaginationLoadMore)
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const q = firstParam(params.q) || undefined;
  const cat = firstParam(params.cat) || undefined;
  const sort = firstParam(params.sort) || undefined;
  const cursor = firstParam(params.cursor) || undefined;
  const minPrice = firstParam(params.minPrice) || undefined;
  const maxPrice = firstParam(params.maxPrice) || undefined;
  const avail = firstParam(params.avail) || undefined;

  const data = await getCatalogPage({ q, cat, sort, cursor, minPrice, maxPrice, avail });

  const { items, nextCursor, hasMore } = data.page;
  const applied = data.filter;
  const activeCategory =
    data.categories.find((category) => category.slug === applied.cat) ?? null;
  const hasFiltered =
    applied.minPrice !== null || applied.maxPrice !== null || applied.avail !== null;

  const heading = activeCategory ? activeCategory.name : q ? "Search results" : "All tools";
  const subtitle = activeCategory
    ? q
      ? `Matching “${q}” in ${activeCategory.name}.`
      : `Everything in ${activeCategory.name} — order online and pay on delivery.`
    : q
      ? `Tools matching “${q}” — order online and pay on delivery.`
      : "Construction tools, materials and safety gear in Rwanda — order online and pay on delivery.";

  const emptyTitle = q
    ? "No tools match your search"
    : hasFiltered
      ? "No tools match your filters"
      : "No tools in this category yet";
  const emptyDescription = q
    ? activeCategory
      ? `We couldn't find any products matching “${q}” in ${activeCategory.name}. Check the spelling or browse the full catalog.`
      : `We couldn't find any products matching “${q}”. Check the spelling or browse the full catalog.`
    : hasFiltered
      ? "No products match the selected price or availability. Widen the range or browse the full catalog."
      : activeCategory
        ? "This category is being restocked — check back soon or browse the full catalog."
        : "The catalog is being stocked — check back soon.";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{heading}</h1>
        <p className="mt-1 text-sm text-stone-600 sm:text-base">{subtitle}</p>
      </header>

      <div className="mt-8 lg:grid lg:grid-cols-[15rem_1fr] lg:items-start lg:gap-10">
        <FilterSidebar
          categories={data.categories}
          activeCat={applied.cat}
          q={applied.q}
          sort={applied.sort}
          minPrice={applied.minPrice}
          maxPrice={applied.maxPrice}
          avail={applied.avail}
        />

        <section aria-labelledby="results-heading" className="mt-6 lg:mt-0">
          <h2 id="results-heading" className="sr-only">
            Product results
          </h2>

          <div className="flex justify-end">
            <Suspense fallback={<SortSkeleton />}>
              <SortSelect value={applied.sort} />
            </Suspense>
          </div>

          {items.length === 0 ? (
            <EmptyState
              className="mt-6"
              icon={<IconSearch className="size-6" />}
              title={emptyTitle}
              description={emptyDescription}
              action={
                <Button href="/products" variant="primary">
                  View all tools
                </Button>
              }
            />
          ) : (
            <ProductGrid initialItems={items} nextCursor={nextCursor} hasMore={hasMore} />
          )}
        </section>
      </div>
    </div>
  );
}
