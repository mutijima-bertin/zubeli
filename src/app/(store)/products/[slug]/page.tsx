import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductDetail, getRelated } from "@/lib/storefront";
import { AddToCartButton } from "./_components/AddToCartButton";
import { Gallery } from "./_components/Gallery";
import { PriceBlock } from "./_components/PriceBlock";
import { RelatedProducts } from "./_components/RelatedProducts";
import { SpecsTable } from "./_components/SpecsTable";
import { StockStatus } from "./_components/StockStatus";
import { TrustStrip } from "./_components/TrustStrip";

/**
 * Product detail (Phase C-2 — product-page-agent).
 *
 * Stock is live (orders restock / drain it), so the page is always
 * server-rendered — fresh stockQty on every request, and `next build`
 * stays independent of a live database. Dynamic params mean no
 * generateStaticParams: a demo store with frequent seed resets would only
 * produce stale static shells.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) {
    return { title: "Product not found | Zubeli" };
  }
  return {
    title: `${product.name} | Zubeli`,
    description:
      product.description ??
      `Buy ${product.name} at Zubeli — quality construction tools in Rwanda, pay on delivery.`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) {
    notFound();
  }
  const related = await getRelated(product, 4);

  // Product structured data (schema.org) — parsed by search engines for
  // rich results: name, image, price in RWF, availability from live stock.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.imageUrls,
    description: product.description ?? undefined,
    category: product.category.name,
    sku: product.slug,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: String(product.priceCents),
      availability:
        product.stockQty > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  // Escape HTML-significant characters inside the serialized JSON before
  // injection: if an admin-entered product field ever contains "</script>",
  // the raw form would terminate the script block early (stored-XSS foot-gun).
  // \u003c etc. are JSON-string escapes — the browser decodes them before
  // parsing, so the structured data stays valid while the block can no
  // longer be broken out of.
  const jsonLdHtml = JSON.stringify(jsonLd)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm">
        <ol className="flex flex-wrap items-center gap-1.5 text-stone-500">
          <li>
            <Link href="/" className="transition-colors hover:text-brand-700">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/products?cat=${product.category.slug}`}
              className="transition-colors hover:text-brand-700"
            >
              {product.category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate font-medium text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={product.imageUrls} name={product.name} />

        {/* Buy box — reflows to a single column under the gallery on mobile. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-sm font-medium text-stone-500">
            {product.category.name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl lg:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <PriceBlock
              priceCents={product.priceCents}
              currency={product.currency}
            />
            <StockStatus
              stockQty={product.stockQty}
              lowStockThreshold={product.lowStockThreshold}
            />
          </div>

          <div className="mt-6">
            <AddToCartButton product={product} />
          </div>

          {/* Buy-box trust strip — delivery + payment reassurance (see TrustStrip). */}
          <TrustStrip />

          {product.stockQty <= 0 && (
            <p className="mt-4 text-sm text-stone-600">
              This item is currently unavailable.{" "}
              <Link
                href="/products"
                className="font-medium text-brand-700 underline-offset-2 transition-colors hover:underline"
              >
                Browse similar tools
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      {product.description && (
        <section
          aria-labelledby="description-heading"
          className="mt-10 max-w-3xl"
        >
          <h2
            id="description-heading"
            className="text-lg font-bold tracking-tight text-ink"
          >
            Description
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-700 sm:text-base">
            {product.description}
          </p>
        </section>
      )}

      <div className="mt-10 max-w-3xl">
        <SpecsTable product={product} />
      </div>

      <RelatedProducts products={related} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml }}
      />
    </div>
  );
}
