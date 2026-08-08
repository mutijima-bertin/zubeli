import Link from "next/link";
import { Badge } from "@/components/ui";
import type { ProductDTO } from "@/types/api";

/**
 * Product specifications table — semantic `<table>` (th scope="row") with
 * the facts we know from ProductDTO: category, availability, featured.
 * Server component; no client state.
 */
export function SpecsTable({ product }: { product: ProductDTO }) {
  const availability =
    product.stockQty <= 0
      ? { label: "Out of stock", tone: "danger" as const }
      : product.stockQty <= product.lowStockThreshold
        ? { label: `Only ${product.stockQty} left`, tone: "warning" as const }
        : { label: "In stock", tone: "success" as const };

  return (
    <section aria-labelledby="specs-heading">
      <h2
        id="specs-heading"
        className="text-lg font-bold tracking-tight text-ink"
      >
        Specifications
      </h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Product specifications for {product.name}
          </caption>
          <tbody className="divide-y divide-stone-200">
            <tr>
              <th
                scope="row"
                className="w-1/3 bg-stone-50 px-4 py-3 text-left font-medium text-stone-600 sm:w-48"
              >
                Category
              </th>
              <td className="px-4 py-3 text-ink">
                <Link
                  href={`/products?cat=${product.category.slug}`}
                  className="underline-offset-2 transition-colors hover:text-brand-700 hover:underline"
                >
                  {product.category.name}
                </Link>
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                className="w-1/3 bg-stone-50 px-4 py-3 text-left font-medium text-stone-600 sm:w-48"
              >
                Availability
              </th>
              <td className="px-4 py-3">
                <Badge tone={availability.tone}>{availability.label}</Badge>
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                className="w-1/3 bg-stone-50 px-4 py-3 text-left font-medium text-stone-600 sm:w-48"
              >
                Featured
              </th>
              <td className="px-4 py-3 text-ink">
                {product.featured ? "Yes" : "No"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
