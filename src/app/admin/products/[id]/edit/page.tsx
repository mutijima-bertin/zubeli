import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductAdminAction } from "@/actions/admin/products";
import { listCategoriesForAdmin } from "@/lib/db/categories";
import { Alert, Button } from "@/components/ui";
import { EditProductClient } from "./_components/EditProductClient";
import { toCategoryOptions } from "../../_components/categoryOptions";

export const metadata: Metadata = {
  title: "Edit product | Admin — Zubeli",
};

/**
 * Edit product — /admin/products/[id]/edit (Inventory).
 * Server shell: fetches the product + categories, renders the EditProductClient
 * (form + quick actions). NOT_FOUND (unknown id) → notFound().
 * Categories come from listCategoriesForAdmin (not listAll) so a product whose
 * category was just deactivated keeps its selected option, labelled
 * "(inactive)" — otherwise saving would silently corrupt the relation.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [productResult, categoryRows] = await Promise.all([
    getProductAdminAction({ productId: id }),
    listCategoriesForAdmin(),
  ]);

   const categories = toCategoryOptions(categoryRows);

  if (!productResult.ok) {
    if (productResult.error.code === "NOT_FOUND") notFound();
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Edit product</h1>
        <Alert tone="danger" title="Couldn't load this product">
          {productResult.error.message}
        </Alert>
        <Button href="/admin/products" variant="outline">
          Back to products
        </Button>
      </div>
    );
  }

  const product = productResult.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Edit: {product.name}</h1>
          <p className="mt-1 text-sm text-stone-600">
            Update details, stock, pricing or availability.
          </p>
        </div>
        <Button href="/admin/products" variant="outline">
          Back to products
        </Button>
      </div>

      <EditProductClient product={product} categories={categories} />
    </div>
  );
}