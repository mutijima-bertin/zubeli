import { ProductCard } from "@/components/storefront/ProductCard";
import type { ProductCardDTO } from "@/types/api";

/**
 * Related products — same category first, padded from featured
 * (getRelated handles the logic server-side). Renders nothing when the
 * pool is empty, so the page never shows a hollow section. Server
 * component; same 1/2/4 grid as the home featured section.
 */
export function RelatedProducts({ products }: { products: ProductCardDTO[] }) {
  if (products.length === 0) return null;

  return (
    <section
      aria-labelledby="related-heading"
      className="mt-14 border-t border-stone-200 pt-10 sm:mt-16"
    >
      <h2
        id="related-heading"
        className="text-xl font-bold tracking-tight text-ink sm:text-2xl"
      >
        Related products
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
