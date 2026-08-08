import Image from "next/image";
import Link from "next/link";
import { Badge, IconBox, Price } from "@/components/ui";
import { cx } from "@/components/ui";
import type { ProductCardDTO } from "@/types/api";

/**
 * Product card — server component, presentational. Image, category, name,
 * Price and a featured/low-stock/out-of-stock Badge; whole card links to
 * /products/{slug}. `actions` is an optional slot (screen agents wire a
 * client quick-add button there).
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
  /** Optional client slot (add-to-cart/quick-add) rendered below the link. */
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
        <div className="relative aspect-square overflow-hidden bg-stone-100">
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
        <div className="p-4 pb-2">
          <p className="text-xs font-medium text-stone-500">{product.category.name}</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-ink transition-colors group-hover:text-brand-700">
            {product.name}
          </h3>
          <div className="mt-2">
            <Price cents={product.priceCents} currency={product.currency} size="md" />
          </div>
        </div>
      </Link>
      {actions && <div className="mt-auto px-4 pb-4 pt-1">{actions}</div>}
    </article>
  );
}