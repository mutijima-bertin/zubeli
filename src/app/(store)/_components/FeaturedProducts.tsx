import { Button, EmptyState, IconArrowRight, IconBox, cx } from "@/components/ui";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { ProductCardDTO } from "@/types/api";

/**
 * Featured products section — grid of shared ProductCards from
 * getHomepageData().featured. Empty state when the store has none.
 * Server component.
 *
 * Grid: with fewer than 4 featured products the 4-col desktop grid would
 * look sparse — render a centered 2-column grid of LARGE cards instead
 * (uiux-reviewer landing audit item 10; demo-critical when the store is
 * thinly seeded).
 */
export function FeaturedProducts({ products }: { products: ProductCardDTO[] }) {
  const gridClasses =
    products.length < 4
      ? "mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mx-auto lg:max-w-3xl"
      : "mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <section aria-labelledby="featured-heading" className="py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cta-600">
              Our picks
            </p>
            <h2
              id="featured-heading"
              className="mt-2 text-2xl font-bold tracking-tight text-ink sm:text-3xl"
            >
              Featured tools
            </h2>
            <p className="mt-1 text-sm text-stone-600 sm:text-base">
              A hand-picked selection for your next build.
            </p>
          </div>
          <Button href="/products" variant="outline" size="sm">
            View all products
            <IconArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {products.length === 0 ? (
          <EmptyState
            className="mt-8"
            icon={<IconBox className="size-6" />}
            title="No featured products yet"
            description="We're stocking the shelves — check back soon or browse the full catalog."
            action={<Button href="/products">Browse all products</Button>}
          />
        ) : (
          <ul className={cx(gridClasses)}>
            {products.map((product) => (
              <li key={product.id}>
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}