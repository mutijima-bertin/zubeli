import Link from "next/link";
import {
  IconAlert,
  IconBox,
  IconCart,
  IconCheck,
  IconMapPin,
  IconMenu,
  IconPlus,
  IconSearch,
  IconShieldCheck,
} from "@/components/ui";
import type { HomepageData } from "@/lib/storefront";

type CategorySummary = HomepageData["categories"][number];
type IconComponent = typeof IconBox;

/** Slug → icon for the seeded category set; unknown slugs fall back to IconBox. */
const CATEGORY_ICONS: Record<string, IconComponent> = {
  "power-tools": IconBox, // tool cases
  "hand-tools": IconPlus, // crossed tool
  "safety-gear": IconShieldCheck, // protection
  "construction-materials": IconCart, // delivered to site
  "fasteners-fixings": IconCheck, // fastened tight
  "measuring-layout": IconSearch, // measure / scan
  plumbing: IconMenu, // stacked pipes
  electrical: IconAlert, // power
  "site-equipment": IconMapPin, // on-site gear
};

/**
 * Category showcase — tiles for the categories that actually have products
 * (productCount > 0), sorted by count DESC so the on-site selection leads.
 * Empty categories are never advertised: the audit called the old all-10
 * grid a "0 products graveyard". With 1–2 non-empty categories the grid
 * collapses to fewer, larger tiles; only when NO category has products do
 * we fall back to the full list + an "on the way" note.
 * Section id="categories" is the anchor target of the hero secondary CTA.
 */
export function CategoriesShowcase({ categories }: { categories: CategorySummary[] }) {
  const nonEmpty = categories
    .filter((category) => category.productCount > 0)
    .sort(
      (a, b) =>
        b.productCount - a.productCount || a.name.localeCompare(b.name),
    );
  const visible = nonEmpty.length > 0 ? nonEmpty : categories;
  const showingFallback = nonEmpty.length === 0;

  const gridClasses =
    visible.length <= 2
      ? "grid-cols-1 sm:grid-cols-2"
      : visible.length <= 4
        ? "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5";

  return (
    <section
      id="categories"
      aria-labelledby="categories-heading"
      className="bg-stone-50 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-cta-600">
          The catalog
        </p>
        <h2
          id="categories-heading"
          className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl"
        >
          Shop by category
        </h2>
        <p className="mt-1 text-sm text-stone-600 sm:text-base">
          From power tools to plumbing — find everything for your build.
        </p>

        {showingFallback ? (
          <p className="mt-8 text-sm text-stone-500">
            Products are on the way — check back soon or browse the full
            catalog.
          </p>
        ) : null}

        <ul className={`mt-8 grid gap-3 ${gridClasses}`}>
          {visible.map((category) => {
            const Icon = CATEGORY_ICONS[category.slug] ?? IconBox;
            return (
              <li key={category.id}>
                <Link
                  href={`/products?cat=${category.slug}`}
                  className="flex h-full flex-col justify-between gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-colors hover:border-brand-300 hover:shadow-pop focus-visible:border-brand-500"
                >
                  <span
                    className="flex size-11 items-center justify-center rounded-lg bg-brand-100 text-brand-800"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-ink sm:text-base">
                    {category.name}
                  </span>
                  <span className="text-xs font-medium text-stone-500">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}