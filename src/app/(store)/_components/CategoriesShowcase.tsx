import Link from "next/link";
import type { HomepageData } from "@/lib/storefront";

type CategorySummary = HomepageData["categories"][number];

/**
 * Category showcase — cards for every category with live product counts,
 * linking to the filtered catalog (/products?cat={slug}).
 * Section id="categories" is the anchor target of the hero secondary CTA.
 */
export function CategoriesShowcase({ categories }: { categories: CategorySummary[] }) {
  return (
    <section
      id="categories"
      aria-labelledby="categories-heading"
      className="bg-stone-50 py-12 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          id="categories-heading"
          className="text-2xl font-bold tracking-tight text-ink sm:text-3xl"
        >
          Shop by category
        </h2>
        <p className="mt-1 text-sm text-stone-600 sm:text-base">
          From power tools to plumbing — find everything for your build.
        </p>

        {categories.length === 0 ? (
          <p className="mt-8 text-sm text-stone-500">
            Categories are on the way — check back soon.
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/products?cat=${category.slug}`}
                  className="flex h-full flex-col justify-between gap-2 rounded-xl border border-stone-200 bg-white p-4 shadow-card transition-colors hover:border-brand-300 hover:shadow-pop focus-visible:border-brand-500"
                >
                  <span className="text-sm font-semibold text-ink sm:text-base">
                    {category.name}
                  </span>
                  <span className="text-xs font-medium text-stone-500">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
