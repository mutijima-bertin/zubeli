import Image from "next/image";
import Link from "next/link";
import { Badge, IconBox, Price } from "@/components/ui";
import { cx } from "@/components/ui";
import { QuickAddToCartButton } from "./QuickAddToCartButton";
import type { ProductCardDTO } from "@/types/api";

/**
 * Product card — server component, presentational. Image, category, name,
 * Price, a stock line (driven by stockQty: In stock / Only N left /
 * Out of stock) and a featured/low-stock/out-of-stock Badge; whole card
 * links to /products/{slug}. `actions` is an override slot: screens passing
 * custom content (e.g. a wishlist) replace the default quick-add entirely.
 *
 * Low-stock is a heuristic (stock ≤ 5): ProductCardDTO has no
 * lowStockThreshold — flagged to database-agent to extend the card select.
 */
export function ProductCard({
  product,
  actions,
  className,
}: {
  product: ProductCardDTO;
  /**
   * Optional slot rendered below the link. When omitted, a default
   * QuickAddToCartButton is rendered (one-tap add from any grid).
   */
  actions?: React.ReactNode;
  className?: string;
}) {
  const href = `/products/${product.slug}`;
  const imageUrl = product.imageUrls[0] ?? null;
  const outOfStock = product.stockQty <= 0;
  const lowStock = !outOfStock && product.stockQty <= 5;

  return (
    <article
      className={cx(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card transition-shadow hover:shadow-pop",
        className,
      )}
    >
      <Link href={href} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-stone-300" aria-hidden="true">
              <IconBox className="size-12" />
            </span>
          )}
          <span className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.featured && <Badge tone="brand">Featured</Badge>}
            {outOfStock && <Badge tone="danger">Out of stock</Badge>}
            {lowStock && <Badge tone="warning">Low stock</Badge>}
          </span>
        </div>
        <div className="p-3 pb-2">
          <p className="text-xs font-medium text-stone-500">{product.category.name}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-ink transition-colors group-hover:text-brand-700">
            {product.name}
          </h3>
          <div className="mt-2">
            <Price cents={product.priceCents} currency={product.currency} size="md" />
          </div>
          {/* Stock line — plain status text (no interactive role). Thresholds
              mirror the badge heuristic above: > 5 in stock, 1–5 low, 0 out. */}
          {outOfStock ? (
            <p className="mt-1 text-xs font-medium text-danger-600">Out of stock</p>
          ) : lowStock ? (
            <p className="mt-1 text-xs font-medium text-amber-700">Only {product.stockQty} left</p>
          ) : (
            <p className="mt-1 text-xs font-medium text-success-700">In stock</p>
          )}
        </div>
      </Link>
      <div className="mt-auto px-3 pb-3 pt-1">
        {actions ?? (
          <QuickAddToCartButton
            productId={product.id}
            slug={product.slug}
            stockQty={product.stockQty}
          />
        )}
      </div>
    </article>
  );
}